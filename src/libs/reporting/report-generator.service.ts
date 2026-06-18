import { Injectable } from '@nestjs/common';
import { PdfRendererService } from 'src/libs/pdf-renderer.service';
import { ReportHtmlService } from './report-html.service';
import type { GeneratedPdfReport, PdfReportDefinition, ReportDocument } from './report.types';

@Injectable()
export class ReportGeneratorService {
	constructor(
		private readonly html: ReportHtmlService,
		private readonly pdfRenderer: PdfRendererService,
	) {}

	async generate<TContext>(
		definition: PdfReportDefinition<TContext>,
		context: TContext,
	): Promise<GeneratedPdfReport> {
		return this.generateDocument(
			definition.buildDocument(context),
			definition.buildFilename(context),
		);
	}

	async generateDocument(document: ReportDocument, filename: string): Promise<GeneratedPdfReport> {
		const html = this.html.build(document);
		const pdf = await this.pdfRenderer.htmlToPdf(html);
		return { pdf, filename };
	}

	async generateZip(
		reports: Array<{ document: ReportDocument; filename: string }>,
		zipFilename: string,
	): Promise<{ zip: Buffer; filename: string }> {
		const files = await Promise.all(
			reports.map(async (report) => ({
				filename: report.filename,
				pdf: await this.pdfRenderer.htmlToPdf(this.html.build(report.document)),
			})),
		);

		return {
			zip: await this.pdfRenderer.filesToZip(files),
			filename: zipFilename,
		};
	}

	async archivePdfFiles(
		files: Array<{ filename: string; pdf: Buffer }>,
		zipFilename: string,
	): Promise<{ zip: Buffer; filename: string }> {
		return {
			zip: await this.pdfRenderer.filesToZip(files),
			filename: zipFilename,
		};
	}
}
