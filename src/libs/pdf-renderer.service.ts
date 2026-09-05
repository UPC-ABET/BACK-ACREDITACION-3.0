import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { ConcurrencyGate, ConcurrencyGateRejection } from './concurrency-gate';
import { reportRenderStrings } from './strings/report-render.strings';

// Dynamic import: puppeteer/archiver are ESM-only, and a static import breaks ts-jest's CommonJS parse.
type PuppeteerBrowser = {
	newPage: () => Promise<any>;
	close: () => Promise<void>;
	connected: boolean;
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

// Also the cap on concurrent Chromium processes (each render launches its own, see renderOnce) —
// start at 1, raise only after staging confirms headroom under the container's memory cap.
const DEFAULT_RENDER_CONCURRENCY = 1;
const DEFAULT_RENDER_TIMEOUT_MS = 120_000;
const DEFAULT_QUEUE_TIMEOUT_MS = 60_000;
const MAX_QUEUED_RENDERS = 20;
const BROWSER_LAUNCH_TIMEOUT_MS = 60_000;
const BROWSER_CLOSE_TIMEOUT_MS = 10_000;

// No --single-process/--no-zygote: Chromium's own team calls that mode unsafe for production (a
// renderer fault kills the whole process), and Puppeteer's issues show recurring crashes on
// Linux/Docker from it, including on browser.close() -- exactly what every render below calls.
// The idle-memory win here comes from launching fresh and closing per render, not from that flag.
const CHROMIUM_ARGS = [
	'--no-sandbox',
	'--disable-setuid-sandbox',
	'--disable-dev-shm-usage',
	'--disable-accelerated-2d-canvas',
	'--no-first-run',
	'--disable-gpu',
];

class RenderTimeoutError extends Error {
	constructor(step: string, timeoutMs: number) {
		super(`PDF render step "${step}" exceeded ${timeoutMs}ms`);
		this.name = 'RenderTimeoutError';
	}
}

/** Always 503: the request is valid, the renderer is transiently saturated/unhealthy, and
 *  retrying is correct. The i18n key says which of the three. */
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
			// try the next candidate path
		}
	}
	return '';
}

export const UPC_LOGO_DATA_URI: string = loadLogoDataUri();

@Injectable()
export class PdfRendererService implements OnModuleDestroy {
	private readonly logger = new Logger(PdfRendererService.name);
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

	/** Every Chromium call is timed out: an unresponsive browser reports `connected: true` while
	 *  never answering the DevTools protocol, so a bare await would hang forever and never free the
	 *  gate permit. */
	private async renderOnce(html: string): Promise<Buffer> {
		const browser = await this.getBrowser();
		try {
			const page = await this.withTimeout(browser.newPage(), this.renderTimeoutMs, 'newPage');
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
		} finally {
			// No separate page.close(): this browser is dedicated to this one render, so closing it
			// tears down its only page too.
			await this.closeBrowser(browser);
		}
	}

	private async getBrowser(): Promise<PuppeteerBrowser> {
		const puppeteerMod: any = await import('puppeteer');
		const puppeteer = puppeteerMod.default ?? puppeteerMod;
		const executablePath = this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH');
		try {
			const browser: PuppeteerBrowser = await puppeteer.launch({
				headless: true,
				...(executablePath ? { executablePath } : {}),
				args: CHROMIUM_ARGS,
				timeout: BROWSER_LAUNCH_TIMEOUT_MS,
				protocolTimeout: this.renderTimeoutMs,
			});
			return browser;
		} catch (error) {
			this.logger.error(`Chromium launch failed: ${this.describe(error)}`);
			throw error;
		}
	}

	private async closeBrowser(browser: PuppeteerBrowser): Promise<void> {
		try {
			await this.withTimeout(browser.close(), BROWSER_CLOSE_TIMEOUT_MS, 'browserClose');
		} catch (error) {
			// close() hangs on the same dead connection a timeout leaves behind; SIGKILL is the last resort.
			this.logger.warn(`Chromium close failed, killing process: ${this.describe(error)}`);
			try {
				browser.process?.()?.kill('SIGKILL');
			} catch {
				// process already gone
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
		// No shared browser to close here -- each render tears down its own (see renderOnce).
		this.shuttingDown = true;
	}
}
