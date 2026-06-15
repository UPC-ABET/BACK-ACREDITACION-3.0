import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
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

const REFRESH_SKEW_MS = 60_000;
// After a failed refresh (dead SSO cookies), don't relaunch Chromium on every
// "Try to refresh" press — report expired until this cooldown passes.
const REFRESH_COOLDOWN_MS = 30_000;
const EXPIRING_WINDOW_MS = 30 * 60_000;
const DEFAULT_TOKEN_TTL_MS = 11 * 60 * 60_000;
const WELCOME_APP_PATH = '/welcome/app/consulta-de-alumnos-matriculados';

@Injectable()
export class BannerTokenService {
	private readonly logger = new Logger(BannerTokenService.name);
	private cachedToken: string | null = null;
	private cachedExpMs: number | null = null;
	private refreshing: Promise<string> | null = null;
	private lastRefreshFailMs: number | null = null;

	constructor(private readonly config: ConfigService) {}

	async getValidToken(forceRefresh = false): Promise<string> {
		if (!forceRefresh && this.cachedToken && !this.isExpiring(this.cachedExpMs)) {
			return this.cachedToken;
		}
		if (this.refreshing) return this.refreshing;
		this.refreshing = this.headlessRefresh().finally(() => {
			this.refreshing = null;
		});
		return this.refreshing;
	}

	getStatus(): { status: SessionStatus; tokenExp: string | null } {
		const expMs = this.cachedExpMs ?? this.decodeExpMs(this.readTokenFromState());
		if (expMs === null) return { status: 'expired', tokenExp: null };

		const remaining = expMs - Date.now();
		const status: SessionStatus =
			remaining <= 0 ? 'expired' : remaining <= EXPIRING_WINDOW_MS ? 'expiring' : 'active';
		return { status, tokenExp: new Date(expMs).toISOString() };
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

		const intranetUrl = this.config.getOrThrow<string>('BANNER_INTRANET_URL');
		const welcomeUrl = new URL(WELCOME_APP_PATH, intranetUrl).toString();
		const executablePath = this.config.get<string>('PUPPETEER_EXECUTABLE_PATH');

		const { chromium } = await import('playwright');
		const browser = await chromium.launch({
			headless: true,
			...(executablePath ? { executablePath } : {}),
			args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
		});

		try {
			const context = await browser.newContext({ storageState: statePath });
			const page = await context.newPage();
			await page.goto(welcomeUrl, { waitUntil: 'domcontentloaded' });

			let token = await this.readTokenFromPage(page);
			if (!token) {
				await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
				token = await this.readTokenFromPage(page);
			}
			if (!token) {
				throw new SessionExpiredError('token absent after headless refresh');
			}

			// Persist refreshed cookies so the SSO session keeps living headlessly.
			// Write it ourselves (not storageState({ path })) to force mode 0600 — the
			// file holds SSO secrets. writeFile's `mode` only applies on creation, so
			// chmod afterwards guarantees 0600 even when the file already exists.
			const state = await context.storageState();
			fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
			fs.chmodSync(statePath, 0o600);
			this.cache(token);
			this.logger.log('Banner token refreshed headlessly');
			return token;
		} finally {
			await browser.close().catch(() => undefined);
		}
	}

	private async readTokenFromPage(page: {
		waitForFunction: (fn: () => boolean, arg?: unknown, opts?: unknown) => Promise<unknown>;
		evaluate: (fn: () => string | null) => Promise<string | null>;
	}): Promise<string | null> {
		type BrowserGlobal = { localStorage: { getItem(key: string): string | null } };
		try {
			await page.waitForFunction(
				() => !!(globalThis as unknown as BrowserGlobal).localStorage.getItem('token'),
				undefined,
				{ timeout: 30_000, polling: 1000 },
			);
		} catch {
			/* fall through to a direct read */
		}
		try {
			return await page.evaluate(() =>
				(globalThis as unknown as BrowserGlobal).localStorage.getItem('token'),
			);
		} catch {
			return null;
		}
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
