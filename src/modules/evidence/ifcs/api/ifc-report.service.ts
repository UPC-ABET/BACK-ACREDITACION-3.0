import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { ifcsValidationStrings } from '../config/strings/ifcs.validation';
import { IfcStatusReportDto } from '../model/ifcs.dtos';
import { ReportGeneratorService } from 'src/libs/reporting/report-generator.service';
import type { ReportDocument, ReportLanguage } from 'src/libs/reporting/report.types';
import { escapeHtml, localize } from 'src/libs/reporting/report.utils';
import { PDF_LABELS } from './ifc-pdf.theme';
import { IfcViewService } from './ifc-view.service';
import { IFC_INSTRUMENT_CODE } from './ifcs.constants';
import * as ExcelJS from 'exceljs';
import { XLSX_THEME } from './pdf-theme';
import { IfcRepository, IfcStatusReportRow } from '../core/ifcs.repository';

const IFC_REPORT_STYLES = `
	section { break-inside: avoid; margin-top: 18px; }
	section h3 { color: #e30613; text-decoration: underline; font-size: 12pt; margin: 0 0 10px; }
	section h4 { font-size: 11pt; margin: 10px 0 6px; }
	thead th { background: #e30613; color: #fff; text-align: left; }
	tbody tr:nth-child(even) td { background: #fafafa; }
	ul { padding-left: 18px; }
	li { margin-bottom: 6px; }
`;

@Injectable()
export class IfcReportService {
	private readonly logger = new Logger(IfcReportService.name);

	constructor(
		private readonly repository: IfcRepository,
		private readonly reportGenerator: ReportGeneratorService,
		private readonly view: IfcViewService,
	) {}

	async generatePdf(ifcId: number, userId: number, schoolId: number, lang: ReportLanguage) {
		const data = await this.view.getView(ifcId, userId, schoolId, false);

		if (data.ifc.status?.code !== TYPE_CODES.IFC_STATUS.APPROVED) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result.pdfFailed,
					errors: [ifcsValidationStrings.error.pdfRequiresApproved],
				},
				HttpStatus.CONFLICT,
			);
		}

		return this.reportGenerator.generateDocument(
			this.buildIfcDocument(data, lang),
			this.buildPdfFilename(data, lang),
		);
	}

	async generatePdfBulk(ifcIds: number[], userId: number, schoolId: number, lang: ReportLanguage) {
		const pLimitMod = await import('p-limit');
		const pLimit = (pLimitMod.default ?? pLimitMod) as (
			concurrency: number,
		) => <T>(fn: () => Promise<T>) => Promise<T>;
		const viewLimit = pLimit(8);
		const renderLimit = pLimit(3);

		const payloads = await Promise.all(
			ifcIds.map((id) => viewLimit(() => this.view.getView(id, userId, schoolId, false))),
		);
		const nonApproved = payloads.find((p) => p.ifc.status?.code !== TYPE_CODES.IFC_STATUS.APPROVED);
		if (nonApproved) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result.pdfBulkFailed,
					errors: [ifcsValidationStrings.error.pdfRequiresApproved],
				},
				HttpStatus.CONFLICT,
			);
		}

		const files = await Promise.all(
			payloads.map((data) =>
				renderLimit(async () =>
					this.reportGenerator.generateDocument(
						this.buildIfcDocument(data, lang),
						this.buildPdfFilename(data, lang),
					),
				),
			),
		);

		const filename = `ZIP_${IFC_INSTRUMENT_CODE}_${lang.toUpperCase()}.zip`;
		return this.reportGenerator.archivePdfFiles(files, filename);
	}

	async generateStatusReport(dto: IfcStatusReportDto, schoolId: number, academicPeriodId: number) {
		const reportCodes = await this.repository.getReportCodes(dto.chartIds, schoolId);
		const schoolCode = reportCodes?.schoolCode ?? undefined;
		if (!schoolCode) {
			this.logger.warn(
				`generateStatusReport: REPORT_CODES_SQL returned no school_code for schoolId=${schoolId}`,
			);
		}
		const programCodes = reportCodes?.programCodes ?? [];
		const codePrefix = schoolCode ?? IFC_INSTRUMENT_CODE;
		const suffix = programCodes.length === 1 ? `${codePrefix}_${programCodes[0]}` : codePrefix;

		const statusTypes = await this.repository.getStatusTypes();
		const statusLabelByCode: Record<string, string> = Object.fromEntries(
			statusTypes.map((s) => [s.code, s.name?.[dto.lang] ?? s.name?.es ?? s.code]),
		);

		const rows = await this.repository.getStatusReportRows(
			dto.chartIds,
			schoolId,
			academicPeriodId,
			dto.lang,
		);

		const xlsx = await this.buildStatusReportXlsx(rows, statusLabelByCode, dto.lang);
		const filename =
			(dto.lang === 'en'
				? `Status_Report_${IFC_INSTRUMENT_CODE}_`
				: `Reporte_Estado_${IFC_INSTRUMENT_CODE}_`) +
			suffix +
			'.xlsx';
		return { xlsx, filename };
	}

	private buildPdfFilename(data: any, lang: ReportLanguage): string {
		const ifc = data.ifc;
		const courseCode = ifc.courseCode ?? '';
		const courseName = (ifc.courseName?.[lang] ?? ifc.courseName?.es ?? '').replace(/\s+/g, '_');
		const period = ifc.academicPeriodCode ?? '';
		const profCode = ifc.coordinator?.code ?? '';
		return `${IFC_INSTRUMENT_CODE}_${courseCode}_${courseName}_${period}_${profCode}.pdf`;
	}

	private buildIfcDocument(data: any, lang: ReportLanguage): ReportDocument {
		const L = PDF_LABELS[lang];
		const ifc = data.ifc;

		const outcomeBullets =
			data.outcomeCourseResult
				.flatMap((p: any) =>
					p.commissions.flatMap((c: any) =>
						c.outcomes.map(
							(o: any) => `
							<li><strong>Student Outcome</strong>
								(${escapeHtml(p.programName?.[lang])} - ${escapeHtml(c.commissionName?.[lang])} - ${escapeHtml(o.outcomeName?.[lang])})
								"${escapeHtml(o.outcomeDescription?.[lang])}"
							</li>`,
						),
					),
				)
				.join('') || `<li class="empty">—</li>`;

		const findingRows =
			data.findings
				.map(
					(f: any) =>
						`<tr><td>${escapeHtml(f.code)}</td><td>${escapeHtml(f.description?.[lang])}</td></tr>`,
				)
				.join('') || `<tr><td colspan="2" class="report-empty">—</td></tr>`;

		const previousActionRows =
			data.previousActions
				.map(
					(a: any) =>
						`<tr><td>${escapeHtml(a.code)}</td><td>${escapeHtml(a.description?.[lang])}</td><td>${escapeHtml(a.completeness?.name?.[lang])}</td></tr>`,
				)
				.join('') || `<tr><td colspan="3" class="report-empty">${escapeHtml(L.s2Empty)}</td></tr>`;

		const actionRows =
			data.findings
				.flatMap((f: any) =>
					f.actions.map(
						(a: any) =>
							`<tr><td>${escapeHtml(a.code)}</td><td>${escapeHtml(a.description?.[lang])}</td><td>${escapeHtml(f.code)}</td></tr>`,
					),
				)
				.join('') || `<tr><td colspan="3" class="report-empty">—</td></tr>`;

		const bodyHtml = `
				<section>
					<h3>${escapeHtml(L.s1Title)}</h3>
					<ul>${outcomeBullets}</ul>
					<h4>${escapeHtml(L.s11Title)}</h4>
					<p>${escapeHtml(ifc.courseLearningOutcome?.[lang]) || '-'}</p>
				</section>

				<section>
					<h3>${escapeHtml(L.s2Title)}</h3>
					<table>
						<thead><tr><th>${escapeHtml(L.s2ColCode)}</th><th>${escapeHtml(L.s2ColDesc)}</th><th>${escapeHtml(L.s2ColState)}</th></tr></thead>
						<tbody>${previousActionRows}</tbody>
					</table>
				</section>

				<section>
					<h3>${escapeHtml(L.s3Title)}</h3>
					<table>
						<thead><tr><th>${escapeHtml(L.s3ColCode)}</th><th>${escapeHtml(L.s3ColDesc)}</th></tr></thead>
						<tbody>${findingRows}</tbody>
					</table>
				</section>

				<section>
					<h3>${escapeHtml(L.s4Title)}</h3>
					<table>
						<thead><tr><th>${escapeHtml(L.s4ColCode)}</th><th>${escapeHtml(L.s4ColDesc)}</th><th>${escapeHtml(L.s4ColFinding)}</th></tr></thead>
						<tbody>${actionRows}</tbody>
					</table>
				</section>
		`;

		const course = [ifc.courseCode, localize(ifc.courseName, lang)].filter(Boolean).join(' - ');

		return {
			language: lang,
			reportName: L.reportTitle,
			programName: localize(ifc.programLabel, lang),
			metadata: [
				{ label: L.semester, value: ifc.academicPeriodCode },
				{ label: L.course, value: course },
				{ label: L.coordinator, value: ifc.coordinator?.name },
			],
			bodyHtml,
			additionalStyles: IFC_REPORT_STYLES,
		};
	}

	private async buildStatusReportXlsx(
		rows: IfcStatusReportRow[],
		statusLabelByCode: Record<string, string>,
		lang: 'es' | 'en',
	): Promise<Buffer> {
		const wb = new ExcelJS.Workbook();
		wb.creator = XLSX_THEME.creator;
		wb.created = new Date();

		const ws = wb.addWorksheet(lang === 'en' ? 'Status Report' : 'Reporte de Estado');

		const HEADERS =
			lang === 'en'
				? ['Course', 'Area', 'Program', 'Status', 'Professor', 'Professor Code', 'Email']
				: ['Curso', 'Área', 'Carrera', 'Estado', 'Docente', 'Código Docente', 'Correo'];

		ws.columns = HEADERS.map((h) => ({ header: h, width: 28 }));

		const headerRow = ws.getRow(1);
		headerRow.height = 22;
		headerRow.eachCell((cell) => {
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_THEME.headerBg } };
			cell.font = { bold: true, color: { argb: XLSX_THEME.headerText } };
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = {
				top: { style: 'thin' },
				left: { style: 'thin' },
				right: { style: 'thin' },
				bottom: { style: 'thin' },
			};
		});

		for (const r of rows) {
			const statusCode = r.statusCode ?? TYPE_CODES.IFC_STATUS.UNREGISTERED;
			ws.addRow([
				r.courseName,
				r.areaLabel,
				r.programLabel,
				statusLabelByCode[statusCode] ?? statusCode,
				r.coordinatorName ?? '—',
				r.coordinatorCode ?? '—',
				r.coordinatorEmail ?? '—',
			]);
		}

		ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
			if (rowNumber === 1) return;
			row.eachCell((cell) => {
				cell.border = {
					top: { style: 'thin', color: { argb: XLSX_THEME.rowBorder } },
					left: { style: 'thin', color: { argb: XLSX_THEME.rowBorder } },
					right: { style: 'thin', color: { argb: XLSX_THEME.rowBorder } },
					bottom: { style: 'thin', color: { argb: XLSX_THEME.rowBorder } },
				};
				cell.alignment = { vertical: 'top', wrapText: true };
			});
		});

		ws.views = [{ state: 'frozen', ySplit: 1 }];

		return Buffer.from(await wb.xlsx.writeBuffer());
	}
}
