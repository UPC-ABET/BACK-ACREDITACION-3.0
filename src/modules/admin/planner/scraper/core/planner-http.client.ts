import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlannerTokenService } from '../../planner-token/api/planner-token.service';
import { PlannerSessionExpiredError } from '../../planner-token/model/planner-session.errors';

export class PlannerHttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = 'PlannerHttpError';
	}
}

const DEFAULT_API_BASE = 'https://upc-e2g-post-api.u-planner.com';
const MAX_5XX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Planner (u-planner) GET client, the analogue of {@link BannerHttpClient}. Ported from the
 * legacy PlannerApiClient: Bearer token, `user=<userId>` appended to every request, the
 * response envelope `{ data: [...] | {...} }` unwrapped to an array. On 401 it forces one
 * token refresh and retries; on 5xx it backs off.
 */
@Injectable()
export class PlannerHttpClient {
	private readonly logger = new Logger(PlannerHttpClient.name);

	constructor(
		private readonly config: ConfigService,
		private readonly tokenService: PlannerTokenService,
	) {}

	async get<T = unknown>(path: string, query: Record<string, string>): Promise<T[]> {
		let session = await this.tokenService.getValidSession();
		let authRetried = false;

		for (let attempt = 0; ; attempt++) {
			const url = this.buildUrl(path, query, session.userId);
			const res = await fetch(url, { method: 'GET', headers: this.headers(session.accessToken) });

			if (res.ok) return this.unwrap<T>(await res.text());

			const message = await this.extractError(res);

			if (res.status === 401 && !authRetried) {
				authRetried = true;
				session = await this.tokenService.getValidSession(true);
				continue;
			}
			if (res.status >= 500 && attempt < MAX_5XX_RETRIES) {
				const backoff = BASE_BACKOFF_MS * 2 ** attempt;
				this.logger.warn(`Planner ${res.status} on ${path}; retry in ${backoff}ms`);
				await sleep(backoff);
				continue;
			}
			if (res.status === 401) throw new PlannerSessionExpiredError(message);
			throw new PlannerHttpError(res.status, message);
		}
	}

	private buildUrl(path: string, query: Record<string, string>, userId: number): string {
		const base = this.config.get<string>('PLANNER_API_BASE') ?? DEFAULT_API_BASE;
		const url = new URL(`${base}${path}`);
		for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
		// The Planner API requires the caller's userId on every request (legacy BuildUrl).
		url.searchParams.set('user', String(userId));
		return url.toString();
	}

	private headers(token: string): Record<string, string> {
		return {
			Authorization: `Bearer ${token}`,
			accept: 'application/json, text/plain, */*',
		};
	}

	// Envelope: { data: [...] } -> the array; { data: {...} } -> [obj]; missing -> [].
	private unwrap<T>(text: string): T[] {
		let json: unknown;
		try {
			json = JSON.parse(text);
		} catch {
			return [];
		}
		const data = (json as { data?: unknown })?.data;
		if (Array.isArray(data)) return data as T[];
		if (data && typeof data === 'object') return [data as T];
		return [];
	}

	private async extractError(res: Response): Promise<string> {
		const text = await res.text();
		try {
			return (JSON.parse(text) as { message?: string })?.message ?? text;
		} catch {
			return text;
		}
	}
}
