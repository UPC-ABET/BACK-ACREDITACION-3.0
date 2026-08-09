import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	PlannerLoginRejectedError,
	PlannerLoginUnreachableError,
} from '../model/session-expired.error';
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

type JsonBody = Record<string, any>;

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

		const data = (body.data ?? {}) as JsonBody;
		const userId = Number(data.user?.id);

		if (typeof data.token !== 'string' || !Number.isFinite(userId)) {
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
		} catch {
			throw new PlannerLoginUnreachableError(`Planner did not answer at ${url}`);
		}

		// 408 and 429 are u-planner telling us to come back, not a verdict on the credentials.
		if (response.status >= 500 || response.status === 408 || response.status === 429) {
			throw new PlannerLoginUnreachableError(`Planner returned ${response.status}`);
		}

		// Read in its own step: the abort signal covers the body stream too, so a stall after the
		// headers arrive fails here — and a transport failure must not read as a wrong password.
		let text: string;
		try {
			text = await response.text();
		} catch {
			throw new PlannerLoginUnreachableError(
				`Planner response body was cut short (${response.status})`,
			);
		}

		let body: JsonBody;
		try {
			body = JSON.parse(text) as JsonBody;
		} catch {
			throw new PlannerLoginRejectedError(
				`Planner returned a non-JSON response (${response.status})`,
			);
		}

		if (!response.ok) {
			throw new PlannerLoginRejectedError(
				`Planner rejected the login (${response.status})${this.describe(body)}`,
			);
		}
		if (body.status === false) {
			throw new PlannerLoginRejectedError(`Planner rejected the login${this.describe(body)}`);
		}
		return body;
	}

	// Response-side only. The request body holds the encoded password and must never be echoed.
	private describe(body: JsonBody): string {
		return typeof body.message === 'string' && body.message.length > 0 ? `: ${body.message}` : '';
	}

	private optionalExpFromJwt(jwt: string): string | null {
		try {
			return this.expFromJwt(jwt);
		} catch {
			return null;
		}
	}

	private expFromJwt(jwt: string): string {
		const exp = Number(this.decodeJwt(jwt).exp);
		if (!Number.isFinite(exp)) {
			throw new PlannerLoginRejectedError('Planner token carried no usable expiry');
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
			throw new PlannerLoginRejectedError('Planner token could not be decoded');
		}
	}
}
