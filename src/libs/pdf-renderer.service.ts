import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
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

	private async getBrowser(): Promise<PuppeteerBrowser> {
		if (this.browser && this.browser.connected) return this.browser;
		const puppeteerMod: any = await import('puppeteer');
		const puppeteer = puppeteerMod.default ?? puppeteerMod;
		const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
		this.browser = await puppeteer.launch({
			headless: true,
			...(executablePath ? { executablePath } : {}),
			args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
		});
		this.logger.log(
			`Chromium launched${executablePath ? ` (executablePath=${executablePath})` : ''}`,
		);
		return this.browser!;
	}

	async htmlToPdf(html: string): Promise<Buffer> {
		const browser = await this.getBrowser();
		const page = await browser.newPage();
		try {
			// Logo is a data URI so 'load' is sufficient — 'networkidle0' is excluded for setContent in puppeteer 25.
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
			await page.close();
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
