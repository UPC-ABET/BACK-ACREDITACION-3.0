import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { ConcurrencyGate, ConcurrencyGateRejection } from './concurrency-gate';
import { reportRenderStrings } from './strings/report-render.strings';

// puppeteer and archiver are pure ESM; loaded via dynamic import so unit tests (CommonJS / ts-jest)
// can import this file without parse errors.
type PuppeteerBrowser = {
	newPage: () => Promise<any>;
	close: () => Promise<void>;
	connected: boolean;
	on?: (event: string, listener: () => void) => void;
	process?: () => { kill: (signal: string) => void } | null;
};

interface ArchiverInstance {
	on(event: 'data', listener: (chunk: Buffer) => void): this;
	on(event: 'end', listener: () => void): this;
	on(event: 'error', listener: (err: Error) => void): this;
	append(source: Buffer, data: { name: string }): this;
	finalize(): Promise<void>;
}

type ArchiverModule = {
	ZipArchive: new (options: { zlib: { level: number } }) => ArchiverInstance;
};

const DEFAULT_RENDER_CONCURRENCY = 2;
const DEFAULT_RENDER_TIMEOUT_MS = 120_000;
const DEFAULT_QUEUE_TIMEOUT_MS = 60_000;
const MAX_QUEUED_RENDERS = 20;
const BROWSER_LAUNCH_TIMEOUT_MS = 60_000;
const BROWSER_CLOSE_TIMEOUT_MS = 10_000;
const PAGE_CLOSE_TIMEOUT_MS = 10_000;

class RenderTimeoutError extends Error {
	constructor(step: string, timeoutMs: number) {
		super(`PDF render step "${step}" exceeded ${timeoutMs}ms`);
		this.name = 'RenderTimeoutError';
	}
}

/**
 * Transport-level failure of the shared Chromium renderer. Always a 503: the request itself is
 * valid, the renderer is momentarily saturated or unhealthy, and retrying is the right client
 * behaviour. The i18n key tells the client which of the three it was.
 */
export class PdfRenderUnavailableError extends HttpException {
	constructor(messageKey: string) {
		super({ message: messageKey }, HttpStatus.SERVICE_UNAVAILABLE);
	}
}

function loadLogoDataUri(): string {
	const candidates = [
		path.resolve(process.cwd(), 'src/assets/upc-logo.png'),
		path.resolve(process.cwd(), 'dist/assets/upc-logo.png'),
		path.resolve(__dirname, '../assets/upc-logo.png'),
	];
	for (const p of candidates) {
		try {
			if (fs.existsSync(p)) {
				const buf = fs.readFileSync(p);
				return `data:image/png;base64,${buf.toString('base64')}`;
			}
		} catch {
			/* try next candidate */
		}
	}
	return '';
}

export const UPC_LOGO_DATA_URI: string = loadLogoDataUri();

@Injectable()
export class PdfRendererService implements OnModuleDestroy {
	private readonly logger = new Logger(PdfRendererService.name);
	private browser: PuppeteerBrowser | null = null;
	private browserLaunch: Promise<PuppeteerBrowser> | null = null;
	private readonly gate: ConcurrencyGate;
	private readonly renderTimeoutMs: number;
	private shuttingDown = false;

	constructor(private readonly configService: ConfigService) {
		this.renderTimeoutMs = this.readNumber('REPORT_RENDER_TIMEOUT_MS', DEFAULT_RENDER_TIMEOUT_MS);
		this.gate = new ConcurrencyGate({
			name: 'pdf-render',
			limit: this.readNumber('REPORT_RENDER_CONCURRENCY', DEFAULT_RENDER_CONCURRENCY),
			maxQueue: MAX_QUEUED_RENDERS,
			acquireTimeoutMs: this.readNumber('REPORT_RENDER_QUEUE_TIMEOUT_MS', DEFAULT_QUEUE_TIMEOUT_MS),
		});
	}

	async htmlToPdf(html: string): Promise<Buffer> {
		if (this.shuttingDown) {
			throw new PdfRenderUnavailableError(reportRenderStrings.error.unavailable);
		}
		try {
			return await this.gate.run(() => this.renderOnce(html));
		} catch (error) {
			throw this.toHttpError(error);
		}
	}

	/**
	 * Every Chromium interaction is timed out. An unresponsive browser answers `connected === true`
	 * while never replying over the DevTools protocol, so without these the awaits hang forever, the
	 * permit is never released, and the gate deadlocks every later export process-wide.
	 */
	private async renderOnce(html: string): Promise<Buffer> {
		const browser = await this.getBrowser();
		let page: any;
		try {
			page = await this.withTimeout(browser.newPage(), this.renderTimeoutMs, 'newPage');
			await this.withTimeout(
				page.setContent(html, { waitUntil: 'load', timeout: this.renderTimeoutMs }),
				this.renderTimeoutMs,
				'setContent',
			);
			await this.withTimeout(page.emulateMediaType('print'), this.renderTimeoutMs, 'emulateMedia');
			const pdf = await this.withTimeout<Uint8Array>(
				page.pdf({
					format: 'A4',
					printBackground: true,
					preferCSSPageSize: true,
					timeout: this.renderTimeoutMs,
				}),
				this.renderTimeoutMs,
				'pdf',
			);
			return Buffer.from(pdf);
		} catch (error) {
			// A timeout means Chromium stopped answering; anything reused from it would hang too.
			if (error instanceof RenderTimeoutError || !browser.connected) {
				await this.recycleBrowser(browser, this.describe(error));
			}
			throw error;
		} finally {
			// Closing a page on a browser that is already gone can only hang; skipping keeps the
			// permit from being held for another full close timeout.
			if (page && browser.connected) {
				await this.withTimeout(page.close(), PAGE_CLOSE_TIMEOUT_MS, 'pageClose').catch(
					() => undefined,
				);
			}
		}
	}

	private async getBrowser(): Promise<PuppeteerBrowser> {
		const current = this.browser;
		if (current?.connected) return current;
		if (this.browserLaunch) return this.browserLaunch;

		const launch = (async () => {
			const puppeteerMod: any = await import('puppeteer');
			const puppeteer = puppeteerMod.default ?? puppeteerMod;
			const executablePath = this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH');
			const browser: PuppeteerBrowser = await puppeteer.launch({
				headless: true,
				...(executablePath ? { executablePath } : {}),
				args: [
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--disable-dev-shm-usage',
					'--disable-gpu',
				],
				timeout: BROWSER_LAUNCH_TIMEOUT_MS,
				protocolTimeout: this.renderTimeoutMs,
			});
			// A crashed Chromium must not stay cached as the live browser, or every later render
			// waits on a dead socket until its own timeout fires.
			browser.on?.('disconnected', () => {
				if (this.browser === browser) this.browser = null;
			});
			this.browser = browser;
			this.logger.log(
				`Chromium launched${executablePath ? ` (executablePath=${executablePath})` : ''}`,
			);
			return browser;
		})();

		this.browserLaunch = launch;
		try {
			return await launch;
		} catch (error) {
			this.logger.error(`Chromium launch failed: ${this.describe(error)}`);
			this.browser = null;
			throw error;
		} finally {
			// Only clear the memo if it is still ours -- a newer launch must not be discarded.
			if (this.browserLaunch === launch) this.browserLaunch = null;
		}
	}

	private async recycleBrowser(browser: PuppeteerBrowser, reason: string): Promise<void> {
		if (this.browser === browser) this.browser = null;
		this.logger.warn(`Recycling Chromium: ${reason}`);
		try {
			await this.withTimeout(browser.close(), BROWSER_CLOSE_TIMEOUT_MS, 'browserClose');
		} catch {
			// close() hangs on the same dead protocol connection that caused the recycle; SIGKILL is
			// the only thing left that reliably stops the process leaking.
			try {
				browser.process?.()?.kill('SIGKILL');
			} catch {
				/* process already gone */
			}
		}
	}

	private withTimeout<T>(promise: Promise<T>, timeoutMs: number, step: string): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => reject(new RenderTimeoutError(step, timeoutMs)), timeoutMs);
			timer.unref?.();
			promise.then(
				(value) => {
					clearTimeout(timer);
					resolve(value);
				},
				(error) => {
					clearTimeout(timer);
					reject(error);
				},
			);
		});
	}

	private toHttpError(error: unknown): Error {
		if (error instanceof HttpException) return error;
		if (error instanceof ConcurrencyGateRejection) {
			this.logger.warn(`PDF render rejected (${error.reason}); ${JSON.stringify(this.gate.stats)}`);
			return new PdfRenderUnavailableError(
				error.reason === 'timeout'
					? reportRenderStrings.error.timeout
					: reportRenderStrings.error.busy,
			);
		}
		if (error instanceof RenderTimeoutError) {
			this.logger.error(error.message);
			return new PdfRenderUnavailableError(reportRenderStrings.error.timeout);
		}
		this.logger.error(`PDF render failed: ${this.describe(error)}`);
		return new PdfRenderUnavailableError(reportRenderStrings.error.unavailable);
	}

	private describe(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}

	private readNumber(key: string, fallback: number): number {
		const raw = this.configService.get<string | number>(key);
		const value = Number(raw);
		return Number.isFinite(value) && value > 0 ? value : fallback;
	}

	async filesToZip(files: Array<{ filename: string; pdf: Buffer }>): Promise<Buffer> {
		const { ZipArchive } = (await import('archiver')) as unknown as ArchiverModule;
		return await new Promise((resolve, reject) => {
			const archive = new ZipArchive({ zlib: { level: 6 } });
			const chunks: Buffer[] = [];
			archive.on('data', (c: Buffer) => chunks.push(c));
			archive.on('end', () => resolve(Buffer.concat(chunks)));
			archive.on('error', reject);
			for (const f of files) {
				archive.append(f.pdf, { name: f.filename });
			}
			void archive.finalize();
		});
	}

	async onModuleDestroy() {
		this.shuttingDown = true;
		const browser = this.browser;
		this.browser = null;
		if (browser) await this.recycleBrowser(browser, 'module shutdown');
	}
}
