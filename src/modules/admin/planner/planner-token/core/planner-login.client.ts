import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	PlannerLoginRejectedError,
	PlannerLoginUnreachableError,
} from '../model/planner-session.errors';
import { PlannerTokenSession } from '../model/planner-session.types';

const DEFAULT_LOGIN_API_URL = 'https://upc-e2g-post-api.u-planner.com/api/user-api';
const DEFAULT_VALIDATE_URL = 'https://upc-e2g-post-api.u-planner.com/api/user-api/validate';

// Both calls run inside the token service's single-flight promise, so an unbounded request does not
// stall one caller — it stalls every caller until it settles. Undici's default is 300s, which is
// long enough to be indistinguishable from a permanent wedge.
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * A login is two sequential bounded calls, so this is its ceiling. Exported because any cooldown
 * guarding a login has to outlast one, or the guard expires while the call it protects is still
 * running — derive from this rather than restating the number.
 */
export const PLANNER_LOGIN_WORST_CASE_MS = REQUEST_TIMEOUT_MS * 2;

type JsonBody = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonBody =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

// 404/405/410 mean the endpoint moved or the configured URL drifted; 408/429 mean try later.
// Neither is a verdict on the credentials.
const UNREACHABLE_STATUSES = new Set([404, 405, 408, 410, 429]);

// `new Date(ms).toISOString()` throws a raw RangeError past ±8.64e15 ms — an error that is neither
// login failure, so it would escape every classifier and surface as a 500.
const MAX_DATE_MS = 8.64e15;
const MAX_EXP_SECONDS = MAX_DATE_MS / 1000;

// Deep enough for undici, which wraps a transport failure at most two or three links down.
const MAX_CAUSE_DEPTH = 4;

const MAX_PROVIDER_MESSAGE_CHARS = 200;

/**
 * The only artefact of a transport failure an operator ever sees is the log line built from this,
 * so DNS, TLS, the abort timeout and a refused redirect have to remain distinguishable. The chain
 * has to be walked to achieve that: undici reports all four as `TypeError: fetch failed` and puts
 * the only discriminating text in `cause`. Safe to include — fetch errors carry no request body, so
 * the encoded password cannot reach it.
 */
const cause = (error: unknown): string => {
	if (!(error instanceof Error)) return '';

	const chain: string[] = [];
	let current: unknown = error;
	while (current instanceof Error && chain.length < MAX_CAUSE_DEPTH) {
		chain.push(`${current.name}: ${current.message}`);
		current = current.cause;
	}
	return ` (${chain.join(' <- ')})`;
};

/**
 * The u-planner login, as the SPA itself performs it: a credential POST that returns a
 * short-lived pre-auth token, then an exchange of that token for the real session.
 *
 * The failure shape was never captured from the live system, so this fails closed: anything
 * missing that is load-bearing — `token`, `user.id` — is a rejection, never a session built from
 * partial data. Fields nothing reads are recorded when present and ignored when absent.
 */
@Injectable()
export class PlannerLoginClient {
	constructor(private readonly config: ConfigService) {}

	async login(username: string, password: string): Promise<PlannerTokenSession> {
		const preAuthToken = await this.requestPreAuthToken(username, password);
		return await this.exchangeForSession(preAuthToken);
	}

	private async requestPreAuthToken(username: string, password: string): Promise<string> {
		const url = this.config.get<string>('PLANNER_LOGIN_API_URL') ?? DEFAULT_LOGIN_API_URL;
		const body = await this.postJson(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({
				name: username,
				// u-planner's own client base64-encodes here. It is obfuscation, not encryption.
				password: Buffer.from(password, 'utf-8').toString('base64'),
				error: false,
				type: 'web',
				authName: '',
			}),
		});

		const token = body.data;
		if (typeof token !== 'string' || token.length === 0) {
			throw new PlannerLoginRejectedError('Planner login returned no pre-auth token');
		}
		return token;
	}

	private async exchangeForSession(preAuthToken: string): Promise<PlannerTokenSession> {
		const url = this.config.get<string>('PLANNER_VALIDATE_URL') ?? DEFAULT_VALIDATE_URL;
		const body = await this.postJson(url, {
			method: 'POST',
			headers: {
				'x-access-token': preAuthToken,
				'content-type': 'application/json',
				accept: 'application/json',
			},
			body: '{}',
		});

		const data = isRecord(body.data) ? body.data : {};
		const user = isRecord(data.user) ? data.user : {};
		const userId = user.id;

		// `Number()` would coerce null, '' and [] to a finite 0 — a session that authenticates and
		// then returns nothing for every `user=0` request, while reporting itself active.
		if (
			typeof data.token !== 'string' ||
			typeof userId !== 'number' ||
			!Number.isInteger(userId) ||
			userId <= 0
		) {
			throw new PlannerLoginRejectedError('Planner validate returned an incomplete session');
		}

		const refreshToken = typeof data.refreshToken === 'string' ? data.refreshToken : undefined;

		return {
			userId,
			accessToken: data.token,
			accessTokenExpiresAt: this.expFromJwt(data.token),
			refreshToken,
			refreshTokenExpiresAt: refreshToken ? this.optionalExpFromJwt(refreshToken) : null,
		};
	}

	/**
	 * Ordering is deliberate: everything meaning "come back later" is settled before anything
	 * meaning "these credentials are wrong", so a slow or overloaded u-planner is never reported
	 * to an operator as a bad password.
	 */
	private async postJson(url: string, init: RequestInit): Promise<JsonBody> {
		let response: Response;
		try {
			response = await fetch(url, {
				...init,
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				// Never follow a redirect while carrying the credential: on a 307/308 the body (which
				// holds the encoded password) and the custom x-access-token header are both preserved
				// across origins, so a hijacked or misconfigured redirect would forward them off-host.
				redirect: 'error',
			});
		} catch (error) {
			throw new PlannerLoginUnreachableError(`Planner did not answer at ${url}${cause(error)}`);
		}

		// Only a credential verdict belongs in the rejected bucket. A 404 or 405 means the endpoint
		// moved or the configured URL drifted — retyping the password will never fix that.
		if (response.status >= 500 || UNREACHABLE_STATUSES.has(response.status)) {
			throw new PlannerLoginUnreachableError(`Planner returned ${response.status}`);
		}

		// Read in its own step: the abort signal covers the body stream too, so a stall after the
		// headers arrive fails here — and a transport failure must not read as a wrong password.
		let text: string;
		try {
			text = await response.text();
		} catch (error) {
			throw new PlannerLoginUnreachableError(
				`Planner response body was cut short (${response.status})${cause(error)}`,
			);
		}

		// Unreachable, not rejected, on both of these: a 2xx that is not JSON is a WAF, a captive
		// proxy or a maintenance page answering for u-planner, which says nothing about the pair.
		// Calling it a rejection returns 400 and arms the penalty, so every operator is rate-limited
		// while retyping a password that was never wrong.
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch (error) {
			throw new PlannerLoginUnreachableError(
				`Planner returned a non-JSON response (${response.status})${cause(error)}`,
			);
		}

		// `JSON.parse('null')` succeeds and would then blow up on the property reads below.
		if (!isRecord(parsed)) {
			throw new PlannerLoginUnreachableError(
				`Planner returned a non-object response (${response.status})`,
			);
		}
		const body = parsed;

		if (!response.ok) {
			throw new PlannerLoginRejectedError(
				`Planner rejected the login (${response.status})${this.providerMessage(body)}`,
			);
		}
		if (body.status === false) {
			throw new PlannerLoginRejectedError(
				`Planner rejected the login${this.providerMessage(body)}`,
			);
		}
		return body;
	}

	/**
	 * Response-side only. The request body holds the encoded password and must never be echoed.
	 *
	 * Truncated because this is the one path by which text from outside our process reaches our
	 * logs: a verbose or compromised upstream could otherwise echo the submitted credential back,
	 * or write unbounded volume into an aggregated log store.
	 */
	private providerMessage(body: JsonBody): string {
		return typeof body.message === 'string' && body.message.length > 0
			? `: ${body.message.slice(0, MAX_PROVIDER_MESSAGE_CHARS)}`
			: '';
	}

	private optionalExpFromJwt(jwt: string): string | null {
		try {
			return this.expFromJwt(jwt);
		} catch {
			return null;
		}
	}

	/**
	 * Unreachable rather than rejected, on both this and {@link decodeJwt}: u-planner *accepted* the
	 * credentials and then handed back a token it cannot have meant to send. Blaming the pair would
	 * return 400 and arm the verification penalty, so an operator would retype a correct password
	 * once every 30 seconds against a fault no password can fix.
	 */
	private expFromJwt(jwt: string): string {
		const exp = Number(this.decodeJwt(jwt).exp);
		if (!Number.isFinite(exp) || exp <= 0 || exp > MAX_EXP_SECONDS) {
			throw new PlannerLoginUnreachableError('Planner token carried no usable expiry');
		}
		return new Date(exp * 1000).toISOString();
	}

	private decodeJwt(jwt: string): Record<string, unknown> {
		try {
			const payload = jwt.split('.')[1] ?? '';
			const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
				'utf-8',
			);
			return JSON.parse(json) as Record<string, unknown>;
		} catch {
			throw new PlannerLoginUnreachableError('Planner token could not be decoded');
		}
	}
}
