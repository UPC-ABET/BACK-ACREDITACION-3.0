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

const MAX_5XX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
			if (res.status >= 500 && attempt < MAX_5XX_RETRIES) {
				const backoff = BASE_BACKOFF_MS * 2 ** attempt;
				this.logger.warn(`Banner ${res.status} on ${path}; retry in ${backoff}ms`);
				await sleep(backoff);
				continue;
			}
			throw new BannerHttpError(res.status, message);
		}
	}

	private buildUrl(path: string, query: Record<string, string>): string {
		const base = this.config.getOrThrow<string>('BANNER_BASE_API');
		const url = new URL(`${base}${path}`);
		for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
		return url.toString();
	}

	private headers(token: string): Record<string, string> {
		return {
			Authorization: `Bearer ${token}`,
			'x-api-key': this.config.getOrThrow<string>('BANNER_API_KEY'),
			accept: 'application/json, text/plain, */*',
			origin: this.config.getOrThrow<string>('BANNER_INTRANET_URL'),
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
