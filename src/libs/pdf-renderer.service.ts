import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

// puppeteer and archiver are pure ESM; loaded via dynamic import so unit tests (CommonJS / ts-jest)
// can import this file without parse errors.
type PuppeteerBrowser = {
	newPage: () => Promise<any>;
	close: () => Promise<void>;
	connected: boolean;
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
	private static readonly MAX_CONCURRENT_RENDERS = 2;
	private activeRenders = 0;
	private readonly renderQueue: Array<() => void> = [];

	constructor(private readonly configService: ConfigService) {}

	private async getBrowser(): Promise<PuppeteerBrowser> {
		if (this.browser && this.browser.connected) return this.browser;
		if (this.browserLaunch) return this.browserLaunch;

		this.browserLaunch = (async () => {
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
				timeout: 60000,
			});
			this.browser = browser;
			this.logger.log(
				`Chromium launched${executablePath ? ` (executablePath=${executablePath})` : ''}`,
			);
			return browser;
		})();

		try {
			return await this.browserLaunch;
		} catch (err) {
			this.browser = null;
			throw err;
		} finally {
			this.browserLaunch = null;
		}
	}

	async htmlToPdf(html: string): Promise<Buffer> {
		await this.acquireRenderSlot();
		try {
			const browser = await this.getBrowser();
			const page = await browser.newPage();
			try {
				await page.setContent(html, { waitUntil: 'load' });
				await page.emulateMediaType('print');
				return Buffer.from(
					await page.pdf({
						format: 'A4',
						printBackground: true,
						preferCSSPageSize: true,
					}),
				);
			} finally {
				await page.close().catch(() => undefined);
			}
		} finally {
			this.releaseRenderSlot();
		}
	}

	private acquireRenderSlot(): Promise<void> {
		if (this.activeRenders < PdfRendererService.MAX_CONCURRENT_RENDERS) {
			this.activeRenders++;
			return Promise.resolve();
		}
		return new Promise<void>((resolve) => this.renderQueue.push(resolve));
	}

	private releaseRenderSlot(): void {
		const next = this.renderQueue.shift();
		if (next) {
			next();
		} else {
			this.activeRenders--;
		}
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
		if (this.browser) {
			await this.browser.close().catch(() => undefined);
			this.browser = null;
		}
	}
}
