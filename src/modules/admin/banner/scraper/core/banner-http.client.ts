import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BannerTokenService } from '../../banner-token/api/banner-token.service';

export class BannerHttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = 'BannerHttpError';
	}
}

const MAX_TRANSIENT_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;
const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
// Stable UPC hosts — env-overridable but defaulted so they aren't required config.
const DEFAULT_BANNER_BASE_API = 'https://api-manageraws.upc.edu.pe/intranet-docente/api';
const DEFAULT_BANNER_INTRANET_URL = 'https://intranetdocente-administrativo.upc.edu.pe';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// "Full jitter" (AWS's well-known Exponential Backoff and Jitter pattern): a random wait
// between 0 and the exponential ceiling, not a fixed exponential delay. Requests that all
// failed at the same moment — a real burst observed in production once concurrency rose —
// would otherwise all retry at the same moment too, synchronizing into a second wave of load
// instead of spreading it out.
const jitteredBackoff = (attempt: number): number =>
	Math.random() * Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);

const isRetryableStatus = (status: number): boolean => status >= 500 || status === 429;

// If Banner ever signals rate limiting with a Retry-After header (seconds, or an HTTP date),
// that takes precedence over our own guess — honoring it is standard practice and Banner knows
// its own recovery time better than a fixed backoff curve does. Clamped to MAX_BACKOFF_MS so a
// surprising header value can't stall one request far longer than the rest of the run.
const retryAfterMs = (res: Response): number | null => {
	const header = res.headers.get('retry-after');
	if (!header) return null;
	const seconds = Number(header);
	if (!Number.isNaN(seconds)) return Math.min(MAX_BACKOFF_MS, Math.max(0, seconds * 1000));
	const date = Date.parse(header);
	if (!Number.isNaN(date)) return Math.min(MAX_BACKOFF_MS, Math.max(0, date - Date.now()));
	return null;
};

@Injectable()
export class BannerHttpClient {
	private readonly logger = new Logger(BannerHttpClient.name);

	constructor(
		private readonly config: ConfigService,
		private readonly tokenService: BannerTokenService,
	) {}

	async get<T = unknown>(path: string, query: Record<string, string>): Promise<T> {
		const url = this.buildUrl(path, query);
		let token = await this.tokenService.getValidToken();
		let authRetried = false;

		for (let attempt = 0; ; attempt++) {
			const res = await fetch(url, { method: 'GET', headers: this.headers(token) });
			if (res.ok) return (await res.json()) as T;

			const message = await this.extractError(res);

			if (res.status === 401 && !authRetried) {
				authRetried = true;
				token = await this.tokenService.getValidToken(true);
				continue;
			}
			if (isRetryableStatus(res.status) && attempt < MAX_TRANSIENT_RETRIES) {
				const retryAfter = res.status === 429 ? retryAfterMs(res) : null;
				const backoff = retryAfter ?? jitteredBackoff(attempt);
				this.logger.warn(`Banner ${res.status} on ${path}; retry in ${Math.round(backoff)}ms`);
				await sleep(backoff);
				continue;
			}
			throw new BannerHttpError(res.status, message);
		}
	}

	private buildUrl(path: string, query: Record<string, string>): string {
		const base = this.config.get<string>('BANNER_BASE_API') ?? DEFAULT_BANNER_BASE_API;
		const url = new URL(`${base}${path}`);
		for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
		return url.toString();
	}

	private headers(token: string): Record<string, string> {
		return {
			Authorization: `Bearer ${token}`,
			'x-api-key': this.config.getOrThrow<string>('BANNER_API_KEY'),
			accept: 'application/json, text/plain, */*',
			origin: this.config.get<string>('BANNER_INTRANET_URL') ?? DEFAULT_BANNER_INTRANET_URL,
			'user-agent': USER_AGENT,
		};
	}

	private async extractError(res: Response): Promise<string> {
		const text = await res.text();
		try {
			return JSON.parse(text)?.cabecera?.mensajeRespuesta ?? text;
		} catch {
			return text;
		}
	}
}
