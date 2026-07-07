import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import type { BrowserContext, BrowserContextOptions, Page } from 'playwright';
import { SessionExpiredError } from '../model/session-expired.error';

export type SessionStatus = 'active' | 'expiring' | 'expired';

interface StorageStateEntry {
	name: string;
	value: string;
}
interface StorageStateOrigin {
	origin: string;
	localStorage?: StorageStateEntry[];
}
interface StorageState {
	origins?: StorageStateOrigin[];
}

// The full Playwright storage-state object (cookies + origins), passed to
// newContext after we strip it down to the Microsoft SSO session.
type PlaywrightStorageState = Exclude<NonNullable<BrowserContextOptions['storageState']>, string>;

const REFRESH_SKEW_MS = 60_000;
// After a failed refresh (dead SSO cookies), don't relaunch Chromium on every
// "Try to refresh" press — report expired until this cooldown passes.
const REFRESH_COOLDOWN_MS = 30_000;
const EXPIRING_WINDOW_MS = 30 * 60_000;
const DEFAULT_TOKEN_TTL_MS = 11 * 60 * 60_000;

// The micuenta SSO entry that mints a fresh token via the redirect chain
// (micuenta -> Microsoft silent re-auth -> GenerarToken -> ?_tk=<JWT>). A plain
// intranet page only reads the existing localStorage token; it never re-mints.
const DEFAULT_MICUENTA_ENTRY = 'https://micuenta.upc.edu.pe/Group/Index';
// Cookies to KEEP: only the Microsoft persistent-login session. Dropping the UPC
// cookies forces micuenta to start a fresh session and mint a new token instead
// of replaying the old one.
const KEEP_COOKIE_RE =
	/microsoftonline|microsoft\.com|live\.com|msftauth|msauth|windows\.net|office/i;
// Cloudflare fronts micuenta and intermittently returns these — transient, retry.
const GATEWAY_STATUSES = new Set([502, 503, 504, 520, 521, 522, 523, 524]);
// A real desktop UA; the default "HeadlessChrome" UA can be screened out.
const REFRESH_USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
	'(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const MAX_REFRESH_ATTEMPTS = 6;
const RETRY_BACKOFF_MS = 30_000;
const TOKEN_WAIT_MS = 30_000;

@Injectable()
export class BannerTokenService {
	private readonly logger = new Logger(BannerTokenService.name);
	private cachedToken: string | null = null;
	private cachedExpMs: number | null = null;
	private refreshing: Promise<string> | null = null;
	private lastRefreshFailMs: number | null = null;

	constructor(private readonly config: ConfigService) {}

	async getValidToken(forceRefresh = false): Promise<string> {
		if (!forceRefresh) {
			if (this.cachedToken && !this.isExpiring(this.cachedExpMs)) {
				return this.cachedToken;
			}
			// A streamed login (browser-auth) writes a fresh token to auth_state.json
			// without touching this cache — adopt it if still valid, no browser launch.
			const fileToken = this.readTokenFromState();
			if (fileToken && !this.isExpiring(this.decodeExpMs(fileToken))) {
				this.cache(fileToken);
				return fileToken;
			}
		}
		if (this.refreshing) return this.refreshing;
		this.refreshing = this.headlessRefresh().finally(() => {
			this.refreshing = null;
		});
		return this.refreshing;
	}

	getStatus(): { status: SessionStatus; tokenExp: string | null } {
		// Use the freshest of the cache and the file: a streamed login updates the
		// file but not the cache, so the file may hold a newer token than the cache.
		const expMs = this.latestExp(this.cachedExpMs, this.decodeExpMs(this.readTokenFromState()));
		if (expMs === null) return { status: 'expired', tokenExp: null };

		const remaining = expMs - Date.now();
		const status: SessionStatus =
			remaining <= 0 ? 'expired' : remaining <= EXPIRING_WINDOW_MS ? 'expiring' : 'active';
		return { status, tokenExp: new Date(expMs).toISOString() };
	}

	private latestExp(a: number | null, b: number | null): number | null {
		if (a === null) return b;
		if (b === null) return a;
		return Math.max(a, b);
	}

	// Refreshes only if the token is expired/expiring (no-op if valid), and
	// short-circuits during the post-failure cooldown — so repeated presses don't
	// relaunch Chromium. Returns expired (not throws) when the cookies are dead.
	async refresh(): Promise<{ status: SessionStatus; tokenExp: string | null }> {
		if (
			this.lastRefreshFailMs !== null &&
			Date.now() - this.lastRefreshFailMs < REFRESH_COOLDOWN_MS
		) {
			return { status: 'expired', tokenExp: null };
		}
		try {
			await this.getValidToken(false);
			this.lastRefreshFailMs = null;
		} catch (error) {
			if (error instanceof SessionExpiredError) {
				this.lastRefreshFailMs = Date.now();
				return { status: 'expired', tokenExp: null };
			}
			throw error;
		}
		return this.getStatus();
	}

	private isExpiring(expMs: number | null): boolean {
		if (expMs === null) return true;
		return expMs - Date.now() <= REFRESH_SKEW_MS;
	}

	private async headlessRefresh(): Promise<string> {
		const statePath = this.config.getOrThrow<string>('BANNER_AUTH_STATE_PATH');
		if (!fs.existsSync(statePath)) {
			throw new SessionExpiredError('auth_state.json not found');
		}

		// Keep only the Microsoft SSO cookies and drop the stale token, so micuenta
		// is forced to re-authenticate silently and mint a *fresh* token through the
		// SSO redirect chain (reusing the UPC session just replays the old token).
		const state = this.microsoftOnlyState(statePath);
		const entryUrl = this.config.get<string>('BANNER_MICUENTA_URL') ?? DEFAULT_MICUENTA_ENTRY;
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
				'--disable-blink-features=AutomationControlled',
			],
		});

		try {
			const context = await browser.newContext({
				storageState: state,
				userAgent: REFRESH_USER_AGENT,
				viewport: { width: 1366, height: 768 },
				locale: 'es-PE',
			});
			// Hide the headless automation fingerprint micuenta/Cloudflare screen for.
			await context.addInitScript(() => {
				Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
			});

			const token = await this.mintToken(context, entryUrl);
			if (!token) {
				throw new SessionExpiredError('token absent after headless refresh');
			}

			// Persist refreshed cookies so the SSO session keeps living headlessly.
			// Write it ourselves (not storageState({ path })) to force mode 0600 — the
			// file holds SSO secrets. writeFile's `mode` only applies on creation, so
			// chmod afterwards guarantees 0600 even when the file already exists.
			const refreshed = await context.storageState();
			fs.writeFileSync(statePath, JSON.stringify(refreshed), { mode: 0o600 });
			fs.chmodSync(statePath, 0o600);
			this.cache(token);
			this.logger.log('Banner token refreshed headlessly');
			return token;
		} finally {
			await browser.close().catch(() => undefined);
		}
	}

	// Drives the micuenta SSO redirect chain and returns the freshly minted JWT.
	// The token surfaces either as a `?_tk=<JWT>` query param mid-redirect or in
	// localStorage once the chain settles; we watch for both. Transient Cloudflare
	// 5xx gateway errors are retried with a backoff; any other dead end (no token,
	// no gateway error) means the Microsoft cookie is dead — stop and surface it.
	private async mintToken(context: BrowserContext, entryUrl: string): Promise<string | null> {
		// Held in an object so the async event listeners below mutate shared state
		// (the closure-captured `flow`) rather than reassigning outer locals.
		const flow: { captured: string | null; gatewayHit: boolean } = {
			captured: null,
			gatewayHit: false,
		};

		const grab = (url: string): void => {
			if (flow.captured) return;
			try {
				const tk = new URL(url).searchParams.get('_tk');
				if (tk) flow.captured = tk;
			} catch {
				/* not a URL */
			}
		};
		const watch = (page: Page): void => {
			page.on('framenavigated', (frame) => {
				if (frame === page.mainFrame()) grab(frame.url());
			});
			page.on('request', (request) => grab(request.url()));
			page.on('response', (response) => {
				if (GATEWAY_STATUSES.has(response.status())) flow.gatewayHit = true;
			});
		};

		context.on('page', watch);
		const page = await context.newPage();
		watch(page);

		for (let attempt = 1; attempt <= MAX_REFRESH_ATTEMPTS && !flow.captured; attempt++) {
			flow.gatewayHit = false;
			const response = await page
				.goto(entryUrl, { waitUntil: 'domcontentloaded' })
				.catch(() => null);
			if (response && GATEWAY_STATUSES.has(response.status())) flow.gatewayHit = true;
			// The SSO chain is async; networkidle may never settle (beacons) — best-effort.
			await page.waitForLoadState('networkidle').catch(() => undefined);

			const deadline = Date.now() + TOKEN_WAIT_MS;
			while (!flow.captured && !flow.gatewayHit && Date.now() < deadline) {
				flow.captured = await this.readTokenFromContext(context);
				if (!flow.captured) await page.waitForTimeout(1000);
			}

			if (flow.captured) break;
			if (flow.gatewayHit) {
				await page.waitForTimeout(RETRY_BACKOFF_MS);
				continue;
			}
			break; // non-gateway dead end — don't retry
		}
		return flow.captured;
	}

	private async readTokenFromContext(context: BrowserContext): Promise<string | null> {
		type BrowserGlobal = { localStorage: { getItem(key: string): string | null } };
		for (const page of context.pages()) {
			try {
				const token = await page.evaluate(() =>
					(globalThis as unknown as BrowserGlobal).localStorage.getItem('token'),
				);
				if (token) return token;
			} catch {
				/* page mid-navigation */
			}
		}
		return null;
	}

	private microsoftOnlyState(statePath: string): PlaywrightStorageState {
		const state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as PlaywrightStorageState;
		state.cookies = (state.cookies ?? []).filter((cookie) =>
			KEEP_COOKIE_RE.test(cookie.domain ?? ''),
		);
		for (const origin of state.origins ?? []) {
			origin.localStorage = (origin.localStorage ?? []).filter((entry) => entry.name !== 'token');
		}
		return state;
	}

	private readTokenFromState(): string | null {
		const statePath = this.config.get<string>('BANNER_AUTH_STATE_PATH');
		if (!statePath || !fs.existsSync(statePath)) return null;
		try {
			const state: StorageState = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
			for (const origin of state.origins ?? []) {
				const entry = origin.localStorage?.find((e) => e.name === 'token');
				if (entry?.value) return entry.value;
			}
		} catch {
			/* unreadable / malformed state */
		}
		return null;
	}

	private cache(token: string): void {
		this.cachedToken = token;
		this.cachedExpMs = this.decodeExpMs(token) ?? Date.now() + DEFAULT_TOKEN_TTL_MS;
	}

	private decodeExpMs(token: string | null): number | null {
		if (!token) return null;
		const parts = token.split('.');
		if (parts.length < 2) return null;
		try {
			const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
			return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
		} catch {
			return null;
		}
	}
}
