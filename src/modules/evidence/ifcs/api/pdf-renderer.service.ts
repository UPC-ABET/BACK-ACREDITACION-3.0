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

function loadLogoDataUri(): string {
	const candidates = [
		path.resolve(process.cwd(), 'src/assets/upc-logo.png'),
		path.resolve(process.cwd(), 'dist/assets/upc-logo.png'),
		path.resolve(__dirname, '../../../../assets/upc-logo.png'),
	];
	for (const p of candidates) {
		try {
			if (fs.existsSync(p)) {
				const buf = fs.readFileSync(p);
				return `data:image/png;base64,${buf.toString('base64')}`;
			}
		} catch {
			// continue
		}
	}
	return '';
}

export const UPC_LOGO_DATA_URI: string = loadLogoDataUri();

export const PDF_LABELS = {
	en: {
		university: 'UNIVERSIDAD PERUANA DE CIENCIAS APLICADAS',
		report_title: 'END OF SEMESTER REPORT',
		semester: 'SEMESTER',
		course: 'COURSE',
		coordinator: 'COURSE COORDINATOR',
		s1_title: '1. GENERAL INFORMATION',
		s11_title: '1.1 RESULT ACHIEVED',
		s2_title: '2. PRIOR FINDINGS AND ACTIONS',
		s2_empty: 'No prior actions available for this report.',
		s2_col_code: 'CODE',
		s2_col_desc: 'DESCRIPTION',
		s2_col_state: 'STATE',
		s3_title: '3. FINDINGS',
		s3_col_code: 'CODE',
		s3_col_desc: 'DESCRIPTION',
		s4_title: '4. IMPROVEMENT ACTIONS',
		s4_col_code: 'CODE',
		s4_col_desc: 'DESCRIPTION',
		s4_col_finding: 'FINDING CODE',
	},
	es: {
		university: 'UNIVERSIDAD PERUANA DE CIENCIAS APLICADAS',
		report_title: 'INFORME DE FIN DE CICLO',
		semester: 'CICLO',
		course: 'CURSO',
		coordinator: 'COORDINADOR DE CURSO',
		s1_title: '1. INFORMACIÓN GENERAL',
		s11_title: '1.1 RESULTADO ALCANZADO',
		s2_title: '2. HALLAZGOS Y ACCIONES PREVIAS',
		s2_empty: 'No hay acciones previas disponibles para este informe.',
		s2_col_code: 'CÓDIGO',
		s2_col_desc: 'DESCRIPCIÓN',
		s2_col_state: 'ESTADO',
		s3_title: '3. HALLAZGOS',
		s3_col_code: 'CÓDIGO',
		s3_col_desc: 'DESCRIPCIÓN',
		s4_title: '4. ACCIONES PROPUESTAS',
		s4_col_code: 'CÓDIGO',
		s4_col_desc: 'DESCRIPCIÓN',
		s4_col_finding: 'CÓDIGO HALLAZGO',
	},
} as const;

export const PDF_STYLES = `
	@page { size: A4; margin: 18mm 14mm; }
	body { font-family: -apple-system, system-ui, sans-serif; color: #18181b; font-size: 11pt; }
	header { text-align: center; }
	.logo { width: 50px; margin: 0 auto 8px; display: block; }
	.title, .subtitle { color: #C8102E; margin: 0; font-weight: 700; }
	.title { font-size: 13pt; }
	.subtitle { font-size: 12pt; margin-top: 4px; }
	.report-title { color: #C8102E; text-decoration: underline; font-size: 14pt; margin: 12px 0; }
	.rule { border: 0; border-top: 1px solid #C8102E; margin: 16px 0; }
	section h3 { color: #C8102E; text-decoration: underline; font-size: 12pt; margin-top: 12px; }
	section h4 { font-size: 11pt; margin-top: 8px; }
	table { width: 100%; border-collapse: collapse; margin-top: 8px; }
	th { background: #C8102E; color: #fff; padding: 6px 8px; text-align: left; font-size: 10.5pt; }
	td { padding: 6px 8px; border: 1px solid #d4d4d8; font-size: 10.5pt; vertical-align: top; }
	tbody tr:nth-child(even) td { background: #fafafa; }
	.empty { text-align: center; font-style: italic; color: #71717a; }
	ul { padding-left: 18px; }
	li { margin-bottom: 6px; }
`;

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
		// archiver 8.x ESM dropped the factory function; only the class constructors are exported.
		const { ZipArchive } = (await import('archiver')) as any;
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
