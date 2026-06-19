import { Module } from '@nestjs/common';
import { PdfRendererService } from 'src/libs/pdf-renderer.service';
import { ReportChartService } from './report-chart.service';
import { ReportGeneratorService } from './report-generator.service';
import { ReportHtmlService } from './report-html.service';

@Module({
	providers: [PdfRendererService, ReportHtmlService, ReportChartService, ReportGeneratorService],
	exports: [PdfRendererService, ReportHtmlService, ReportChartService, ReportGeneratorService],
})
export class ReportModule {}
