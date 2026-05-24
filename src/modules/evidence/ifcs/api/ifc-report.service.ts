import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';
import { ifcsValidationStrings } from '../config/strings/ifcs.validation';
import { IfcStatusReportDto } from '../model/ifcs.dtos';
import {
	PDF_LABELS,
	PdfRendererService,
	PDF_STYLES,
	UPC_LOGO_DATA_URI,
} from './pdf-renderer.service';
import { IfcViewService } from './ifc-view.service';
import { REPORT_CODES_SQL, STATUS_REPORT_SQL } from './ifcs.sql';
import * as ExcelJS from 'exceljs';

interface StatusReportRow {
	course_name: string;
	area_label: string;
	program_label: string;
	coordinator_name: string | null;
	coordinator_email: string | null;
	coordinator_code: string | null;
	status_code: string | null;
}

@Injectable()
export class IfcReportService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly pdfRenderer: PdfRendererService,
		private readonly view: IfcViewService,
	) {}

	async generatePdf(ifcId: number, userId: number, schoolId: number, lang: 'es' | 'en') {
		const data = await this.view.getView(ifcId, userId, schoolId);

		if (data.ifc.status?.code !== TYPE_CODES.IFC_STATUS.APPROVED) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result.pdfFailed,
					errors: [ifcsValidationStrings.error.pdfRequiresApproved],
				},
				HttpStatus.CONFLICT,
			);
		}

		const html = this.buildIfcHtml(data, lang);
		const pdf = await this.pdfRenderer.htmlToPdf(html);
		const filename = this.buildPdfFilename(data, lang);
		return { pdf, filename };
	}

	async generatePdfBulk(ifcIds: number[], userId: number, schoolId: number, lang: 'es' | 'en') {
		const payloads = await Promise.all(ifcIds.map((id) => this.view.getView(id, userId, schoolId)));
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
			payloads.map(async (data) => ({
				filename: this.buildPdfFilename(data, lang),
				pdf: await this.pdfRenderer.htmlToPdf(this.buildIfcHtml(data, lang)),
			})),
		);

		const zip = await this.pdfRenderer.filesToZip(files);
		const filename = `ZIP_IFC_${lang.toUpperCase()}.zip`;
		return { zip, filename };
	}

	async generateStatusReport(dto: IfcStatusReportDto, schoolId: number) {
		const codeRow = await this.dataSource.query(REPORT_CODES_SQL, [
			dto.chart_ids,
			schoolId,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
		]);
		const schoolCode: string = codeRow[0]?.school_code ?? 'IFC';
		const programCodes: string[] = codeRow[0]?.program_codes ?? [];
		const suffix = programCodes.length === 1 ? `${schoolCode}_${programCodes[0]}` : schoolCode;

		const statusTypes: Array<{ code: string; name: { es?: string; en?: string } }> =
			await this.dataSource.query(
				`SELECT t.code, t.name FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id WHERE g.code = $1`,
				[TYPE_GROUP_CODES.IFC_STATUS],
			);
		const statusLabelByCode: Record<string, string> = Object.fromEntries(
			statusTypes.map((s) => [s.code, s.name?.[dto.lang] ?? s.name?.es ?? s.code]),
		);

		const rows: StatusReportRow[] = await this.dataSource.query(STATUS_REPORT_SQL, [
			dto.chart_ids,
			dto.period_id,
			schoolId,
			TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
			dto.lang,
		]);

		const xlsx = await this.buildStatusReportXlsx(rows, statusLabelByCode, dto.lang);
		const filename =
			(dto.lang === 'en' ? 'Status_Report_IFC_' : 'Reporte_Estado_IFC_') + suffix + '.xlsx';
		return { xlsx, filename };
	}

	private buildPdfFilename(data: any, lang: 'es' | 'en'): string {
		const ifc = data.ifc;
		const courseCode = ifc.course_code ?? '';
		const courseName = (ifc.course_name?.[lang] ?? ifc.course_name?.es ?? '').replace(/\s+/g, '_');
		const period = ifc.academic_period_code ?? '';
		const profCode = ifc.coordinator?.code ?? '';
		return `IFC_${courseCode}_${courseName}_${period}_${profCode}.pdf`;
	}

	private buildIfcHtml(data: any, lang: 'es' | 'en'): string {
		const L = PDF_LABELS[lang];
		const ifc = data.ifc;

		const outcomeBullets =
			data.outcome_course_result
				.flatMap((p: any) =>
					p.commissions.flatMap((c: any) =>
						c.outcomes.map(
							(o: any) => `
							<li><strong>Student Outcome</strong>
								(${esc(p.program_name?.[lang])} - ${esc(c.commission_name?.[lang])} - ${esc(o.outcome_name?.[lang])})
								"${esc(o.outcome_description?.[lang])}"
							</li>`,
						),
					),
				)
				.join('') || `<li class="empty">—</li>`;

		const findingRows =
			data.findings
				.map((f: any) => `<tr><td>${esc(f.code)}</td><td>${esc(f.description?.[lang])}</td></tr>`)
				.join('') || `<tr><td colspan="2" class="empty">—</td></tr>`;

		const actionRows =
			data.findings
				.flatMap((f: any) =>
					f.actions.map(
						(a: any) =>
							`<tr><td>${esc(a.code)}</td><td>${esc(a.description?.[lang])}</td><td>${esc(f.code)}</td></tr>`,
					),
				)
				.join('') || `<tr><td colspan="3" class="empty">—</td></tr>`;

		const logoTag = UPC_LOGO_DATA_URI
			? `<img class="logo" src="${UPC_LOGO_DATA_URI}" alt="UPC" />`
			: '';

		return `
			<!doctype html>
			<html lang="${lang}">
			<head>
				<meta charset="utf-8" />
				<title>${esc(L.report_title)}</title>
				<style>${PDF_STYLES}</style>
			</head>
			<body>
				<header>
					${logoTag}
					<h1 class="title">${esc(L.university)}</h1>
					<h2 class="subtitle">${esc(ifc.program_label?.[lang] ?? '')}</h2>
					<hr class="rule" />
					<h2 class="report-title">${esc(L.report_title)}</h2>
					<p><strong>${esc(L.semester)}:</strong> ${esc(ifc.academic_period_code)}</p>
					<p><strong>${esc(L.course)}:</strong> ${esc(ifc.course_code ?? '')} - ${esc(ifc.course_name?.[lang])}</p>
					<p><strong>${esc(L.coordinator)}:</strong> ${esc(ifc.coordinator?.name ?? '')}</p>
				</header>

				<hr class="rule" />

				<section>
					<h3>${esc(L.s1_title)}</h3>
					<ul>${outcomeBullets}</ul>
					<h4>${esc(L.s11_title)}</h4>
					<p>${esc(ifc.course_learning_outcome?.[lang]) || '-'}</p>
				</section>

				<hr class="rule" />

				<section>
					<h3>${esc(L.s2_title)}</h3>
					<table>
						<thead><tr><th>${esc(L.s2_col_code)}</th><th>${esc(L.s2_col_desc)}</th><th>${esc(L.s2_col_state)}</th></tr></thead>
						<tbody><tr><td colspan="3" class="empty">${esc(L.s2_empty)}</td></tr></tbody>
					</table>
				</section>

				<hr class="rule" />

				<section>
					<h3>${esc(L.s3_title)}</h3>
					<table>
						<thead><tr><th>${esc(L.s3_col_code)}</th><th>${esc(L.s3_col_desc)}</th></tr></thead>
						<tbody>${findingRows}</tbody>
					</table>
				</section>

				<hr class="rule" />

				<section>
					<h3>${esc(L.s4_title)}</h3>
					<table>
						<thead><tr><th>${esc(L.s4_col_code)}</th><th>${esc(L.s4_col_desc)}</th><th>${esc(L.s4_col_finding)}</th></tr></thead>
						<tbody>${actionRows}</tbody>
					</table>
				</section>
			</body>
			</html>
		`;
	}

	private async buildStatusReportXlsx(
		rows: StatusReportRow[],
		statusLabelByCode: Record<string, string>,
		lang: 'es' | 'en',
	): Promise<Buffer> {
		const wb = new ExcelJS.Workbook();
		wb.creator = 'ABET system';
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
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8102E' } };
			cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = {
				top: { style: 'thin' },
				left: { style: 'thin' },
				right: { style: 'thin' },
				bottom: { style: 'thin' },
			};
		});

		for (const r of rows) {
			const statusCode = r.status_code ?? TYPE_CODES.IFC_STATUS.UNREGISTERED;
			ws.addRow([
				r.course_name,
				r.area_label,
				r.program_label,
				statusLabelByCode[statusCode] ?? statusCode,
				r.coordinator_name ?? '—',
				r.coordinator_code ?? '—',
				r.coordinator_email ?? '—',
			]);
		}

		ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
			if (rowNumber === 1) return;
			row.eachCell((cell) => {
				cell.border = {
					top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
					left: { style: 'thin', color: { argb: 'FFD4D4D8' } },
					right: { style: 'thin', color: { argb: 'FFD4D4D8' } },
					bottom: { style: 'thin', color: { argb: 'FFD4D4D8' } },
				};
				cell.alignment = { vertical: 'top', wrapText: true };
			});
		});

		ws.views = [{ state: 'frozen', ySplit: 1 }];

		return Buffer.from(await wb.xlsx.writeBuffer());
	}
}

function esc(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value).replace(/[<>&"']/g, (ch) => {
		switch (ch) {
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '&':
				return '&amp;';
			case '"':
				return '&quot;';
			case "'":
				return '&#39;';
			default:
				return ch;
		}
	});
}
