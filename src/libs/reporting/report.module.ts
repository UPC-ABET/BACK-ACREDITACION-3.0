import { Module } from '@nestjs/common';
import { PdfRendererService } from 'src/libs/pdf-renderer.service';
import { ReportGeneratorService } from './report-generator.service';
import { ReportHtmlService } from './report-html.service';

@Module({
	providers: [PdfRendererService, ReportHtmlService, ReportGeneratorService],
	exports: [PdfRendererService, ReportHtmlService, ReportGeneratorService],
})
export class ReportModule {}
