import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PlannerSessionExpiredError } from '../model/session-expired.error';
import { PlannerSessionStatus, PlannerTokenSession } from '../model/planner-session.types';

const REFRESH_SKEW_MS = 60_000;
// After a failed login/refresh (dead credentials or u-planner down), don't relaunch
// Chromium on every "Try to refresh" press — report expired until this cooldown passes.
const REFRESH_COOLDOWN_MS = 30_000;
const EXPIRING_WINDOW_MS = 30 * 60_000;

const DEFAULT_LOGIN_URL = 'https://upc-e2g-post.u-planner.com/';
const DEFAULT_VALIDATE_URL = 'https://upc-e2g-post-api.u-planner.com/api/user-api/validate';
const DEFAULT_STORE_PATH = path.join(process.cwd(), '.scraping', 'planner_token_store.json');

// Nuxt-auth localStorage keys on the u-planner SPA.
const TOKEN_KEY = 'auth._token.web-v2';
const REFRESH_KEY = 'auth._refresh_token.web-v2';
const TOKEN_EXP_KEY = 'auth._token_expiration.web-v2';
const REFRESH_EXP_KEY = 'auth._refresh_token_expiration.web-v2';

/**
 * Planner (u-planner) token management, the Planner analogue of {@link BannerTokenService}.
 *
 * Banner needs a manual browser login (the "stopper") streamed over noVNC. Planner does not:
 * the operator credentials (PLANNER_USER / PLANNER_PASSWORD) are submitted headlessly and the
 * JWT access + refresh tokens are read from localStorage. An expired access token is refreshed
 * via the validate API; a fresh browser login only happens when the refresh token is also dead.
 */
@Injectable()
export class PlannerTokenService {
	private readonly logger = new Logger(PlannerTokenService.name);
	private refreshing: Promise<PlannerTokenSession> | null = null;
	private lastFailMs: number | null = null;

	constructor(private readonly config: ConfigService) {}

	// Full session (accessToken + userId). The Planner API requires `user=<userId>` on every
	// request, so the HTTP client needs the userId alongside the token.
	async getValidSession(forceRefresh = false): Promise<PlannerTokenSession> {
		return this.ensureSession(forceRefresh);
	}

	async getValidToken(forceRefresh = false): Promise<string> {
		return (await this.getValidSession(forceRefresh)).accessToken;
	}

	getStatus(): { status: PlannerSessionStatus; tokenExp: string | null } {
		const session = this.readStore();
		if (!session) return { status: 'expired', tokenExp: null };

		const accessRemaining = this.remaining(session.accessTokenExpiresAt);
		const refreshRemaining = this.remaining(session.refreshTokenExpiresAt);

		if (accessRemaining > EXPIRING_WINDOW_MS) {
			return { status: 'active', tokenExp: session.accessTokenExpiresAt };
		}
		// Access expired/expiring but still silently recoverable through the refresh token.
		if (accessRemaining > 0 || refreshRemaining > REFRESH_SKEW_MS) {
			return { status: 'expiring', tokenExp: session.accessTokenExpiresAt };
		}
		return { status: 'expired', tokenExp: session.accessTokenExpiresAt };
	}

	// Refreshes only if the token is expired/expiring (no-op if valid), and short-circuits
	// during the post-failure cooldown so repeated presses don't relaunch Chromium. Returns
	// expired (not throws) when credentials/refresh are dead.
	async refresh(): Promise<{ status: PlannerSessionStatus; tokenExp: string | null }> {
		if (this.lastFailMs !== null && Date.now() - this.lastFailMs < REFRESH_COOLDOWN_MS) {
			return { status: 'expired', tokenExp: null };
		}
		try {
			await this.ensureSession(false);
			this.lastFailMs = null;
		} catch (error) {
			if (error instanceof PlannerSessionExpiredError) {
				this.lastFailMs = Date.now();
				return { status: 'expired', tokenExp: null };
			}
			throw error;
		}
		return this.getStatus();
	}

	// Single-flight: concurrent callers share one login/refresh.
	private ensureSession(forceRefresh: boolean): Promise<PlannerTokenSession> {
		if (this.refreshing) return this.refreshing;
		this.refreshing = this.resolveSession(forceRefresh).finally(() => {
			this.refreshing = null;
		});
		return this.refreshing;
	}

	private async resolveSession(forceRefresh: boolean): Promise<PlannerTokenSession> {
		const existing = this.readStore();
		if (
			existing &&
			!forceRefresh &&
			this.remaining(existing.accessTokenExpiresAt) > REFRESH_SKEW_MS
		) {
			return existing;
		}
		if (existing && this.remaining(existing.refreshTokenExpiresAt) > REFRESH_SKEW_MS) {
			return this.refreshViaApi(existing);
		}
		this.logger.warn('Planner refresh token expired or absent; performing a headless login');
		return this.loginHeadless();
	}

	private async refreshViaApi(session: PlannerTokenSession): Promise<PlannerTokenSession> {
		const validateUrl = this.config.get<string>('PLANNER_VALIDATE_URL') ?? DEFAULT_VALIDATE_URL;
		const res = await fetch(validateUrl, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${session.refreshToken}`,
				'content-type': 'application/json',
				accept: 'application/json',
			},
			body: '{}',
		});
		if (!res.ok) {
			throw new PlannerSessionExpiredError(`Planner token refresh failed (${res.status})`);
		}
		const json = (await res.json()) as { data?: Record<string, any> };
		const data = json.data ?? {};
		if (!data.token || !data.refreshToken) {
			throw new PlannerSessionExpiredError('Planner validate returned no tokens');
		}
		const refreshed: PlannerTokenSession = {
			userId: data.user?.id ?? session.userId,
			accessToken: data.token,
			refreshToken: data.refreshToken,
			accessTokenExpiresAt: this.expFromJwt(data.token),
			refreshTokenExpiresAt: this.expFromJwt(data.refreshToken),
		};
		this.saveStore(refreshed);
		this.logger.log('Planner token refreshed via validate API');
		return refreshed;
	}

	private async loginHeadless(): Promise<PlannerTokenSession> {
		const usuario = this.config.get<string>('PLANNER_USER');
		const password = this.config.get<string>('PLANNER_PASSWORD');
		if (!usuario || !password) {
			throw new PlannerSessionExpiredError('PLANNER_USER / PLANNER_PASSWORD not configured');
		}

		const loginUrl = this.config.get<string>('PLANNER_LOGIN_URL') ?? DEFAULT_LOGIN_URL;
		const executablePath = this.config.get<string>('PUPPETEER_EXECUTABLE_PATH');

		const { chromium } = await import('playwright');
		const browser = await chromium.launch({
			headless: true,
			...(executablePath ? { executablePath } : {}),
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-gpu',
			],
		});

		try {
			const context = await browser.newContext();
			const page = await context.newPage();
			await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

			await page.fill("input[name='username']", usuario);
			await page.fill("input[name='password']", password);
			await page.click('form button.btn-accent');

			try {
				await page.waitForFunction(
					(key: string) => {
						const t = globalThis.localStorage.getItem(key);
						return !!t && t.startsWith('eyJ');
					},
					TOKEN_KEY,
					{ timeout: 20_000, polling: 1000 },
				);
			} catch {
				throw new PlannerSessionExpiredError('Planner login failed (token not issued)');
			}

			// Read the Nuxt-auth JWTs and their expirations straight from localStorage.
			const bag = await page.evaluate(
				(keys: string[]) => keys.map((k) => globalThis.localStorage.getItem(k)),
				[TOKEN_KEY, REFRESH_KEY, TOKEN_EXP_KEY, REFRESH_EXP_KEY],
			);
			const [accessToken, refreshToken, tokenExpRaw, refreshExpRaw] = bag;
			const tokenExp = Number(tokenExpRaw);
			const refreshExp = Number(refreshExpRaw);
			if (
				!accessToken ||
				!refreshToken ||
				!Number.isFinite(tokenExp) ||
				!Number.isFinite(refreshExp)
			) {
				throw new PlannerSessionExpiredError('Planner token/expiration could not be parsed');
			}

			const session: PlannerTokenSession = {
				userId: this.numberFromJwt(accessToken, 'userId'),
				accessToken,
				refreshToken,
				accessTokenExpiresAt: new Date(tokenExp).toISOString(),
				refreshTokenExpiresAt: new Date(refreshExp).toISOString(),
			};
			this.saveStore(session);
			this.logger.log('Planner login successful, tokens captured');
			return session;
		} finally {
			await browser.close().catch(() => undefined);
		}
	}

	private remaining(isoExpiry: string | null): number {
		if (!isoExpiry) return 0;
		const ms = new Date(isoExpiry).getTime();
		return Number.isFinite(ms) ? ms - Date.now() : 0;
	}

	private decodeJwt(jwt: string): Record<string, unknown> {
		const payload = jwt.split('.')[1] ?? '';
		const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
			'utf-8',
		);
		return JSON.parse(json) as Record<string, unknown>;
	}

	private numberFromJwt(jwt: string, key: string): number {
		return Number(this.decodeJwt(jwt)[key]);
	}

	private expFromJwt(jwt: string): string {
		const exp = Number(this.decodeJwt(jwt).exp);
		return new Date(exp * 1000).toISOString();
	}

	private storePath(): string {
		return this.config.get<string>('PLANNER_TOKEN_STORE_PATH') ?? DEFAULT_STORE_PATH;
	}

	private readStore(): PlannerTokenSession | null {
		const file = this.storePath();
		if (!fs.existsSync(file)) return null;
		try {
			return JSON.parse(fs.readFileSync(file, 'utf-8')) as PlannerTokenSession;
		} catch {
			return null;
		}
	}

	private saveStore(session: PlannerTokenSession): void {
		const file = this.storePath();
		fs.mkdirSync(path.dirname(file), { recursive: true });
		// The store holds long-lived JWTs — force mode 0600.
		fs.writeFileSync(file, JSON.stringify(session, null, 2), { mode: 0o600 });
		fs.chmodSync(file, 0o600);
	}
}
