import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ReportGeneratorService } from 'src/libs/reporting/report-generator.service';
import type { ReportDocument, ReportLanguage } from 'src/libs/reporting/report.types';
import { escapeHtml } from 'src/libs/reporting/report.utils';
import { SemaphoreReportsRepository } from '../core/semaphore-reports.repository';
import { SEMAPHORE_PDF_LABELS, SEMAPHORE_REPORT_STYLES } from './semaphore-pdf.theme';
import { semaphoreReportsValidationStrings } from '../config/strings/semaphore-reports.validation';
import type {
	SemaphoreFilterDto,
	SemaphoreReportDto,
	SemaphoreReportSummaryDto,
} from '../model/semaphore-reports.dtos';
import * as ExcelJS from 'exceljs';

const XLSX_HEADER_BG = 'FFE30613';
const XLSX_HEADER_TEXT = 'FFFFFFFF';

@Injectable()
export class SemaphoreReportsService {
	private readonly logger = new Logger(SemaphoreReportsService.name);

	constructor(
		private readonly repository: SemaphoreReportsRepository,
		private readonly reportGenerator: ReportGeneratorService,
	) {}

	async getRcData(dto: SemaphoreFilterDto, academicPeriodId: number): Promise<SemaphoreReportDto> {
		const lang = dto.lang ?? 'es';
		const programCommissionId = dto.programCommissionId ?? null;
		const rows = await this.repository.getRcReport(
			academicPeriodId,
			programCommissionId,
			dto.outcomeId ?? null,
			dto.campusId ?? null,
			dto.modalityTypeId ?? null,
			lang,
		);
		if (rows.length === 0) {
			throw new HttpException(
				{
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.noData],
				},
				HttpStatus.NOT_FOUND,
			);
		}
		const metadata = await this.repository.getMetadata(programCommissionId, academicPeriodId, lang);
		return this.buildReport(rows, metadata);
	}

	async getRvData(dto: SemaphoreFilterDto, academicPeriodId: number): Promise<SemaphoreReportDto> {
		const lang = dto.lang ?? 'es';
		const programCommissionId = dto.programCommissionId ?? null;
		const rows = await this.repository.getRvReport(
			academicPeriodId,
			programCommissionId,
			dto.outcomeId ?? null,
			dto.campusId ?? null,
			dto.modalityTypeId ?? null,
			lang,
		);
		if (rows.length === 0) {
			throw new HttpException(
				{
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.noData],
				},
				HttpStatus.NOT_FOUND,
			);
		}
		const metadata = await this.repository.getMetadata(programCommissionId, academicPeriodId, lang);
		return this.buildReport(rows, metadata);
	}

	async generateRcPdf(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
	): Promise<{ pdf: Buffer; filename: string }> {
		const lang = (dto.lang ?? 'es') as ReportLanguage;
		const data = await this.getRcData(dto, academicPeriodId);
		return this.reportGenerator.generateDocument(
			this.buildDocument(data, 'rc', lang),
			this.buildFilename('rc', lang),
		);
	}

	async generateRvPdf(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
	): Promise<{ pdf: Buffer; filename: string }> {
		const lang = (dto.lang ?? 'es') as ReportLanguage;
		const data = await this.getRvData(dto, academicPeriodId);
		return this.reportGenerator.generateDocument(
			this.buildDocument(data, 'rv', lang),
			this.buildFilename('rv', lang),
		);
	}

	async generateRcExcel(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
	): Promise<{ xlsx: Buffer; filename: string }> {
		const lang = (dto.lang ?? 'es') as 'es' | 'en';
		const data = await this.getRcData(dto, academicPeriodId);
		const xlsx = await this.buildExcel(data, 'rc', lang);
		const filename = `Reporte_Semaforo_RC_${Date.now()}.xlsx`;
		return { xlsx, filename };
	}

	async generateRvExcel(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
	): Promise<{ xlsx: Buffer; filename: string }> {
		const lang = (dto.lang ?? 'es') as 'es' | 'en';
		const data = await this.getRvData(dto, academicPeriodId);
		const xlsx = await this.buildExcel(data, 'rv', lang);
		const filename = `Reporte_Semaforo_RV_${Date.now()}.xlsx`;
		return { xlsx, filename };
	}

	private buildReport(
		rows: Array<{
			courseCode: string;
			courseName: string;
			outcomeCode: string;
			outcomeName: string;
			totalStudents: number;
			studentsAchieved: number;
			percentageAchieved: number;
			sede: string;
			cicloAcademico: string;
			color: string;
		}>,
		metadata: {
			programName: string;
			commissionName: string;
			academicPeriodCode: string;
			accreditorCode: string;
		} | null,
	): SemaphoreReportDto {
		const summary: SemaphoreReportSummaryDto[] = rows.map((r) => ({
			courseCode: r.courseCode,
			courseName: r.courseName,
			outcomeCode: r.outcomeCode,
			outcomeName: r.outcomeName,
			totalStudents: Number(r.totalStudents),
			studentsAchieved: Number(r.studentsAchieved),
			percentageAchieved: Number(r.percentageAchieved),
			color: r.color,
			sede: r.sede,
			cicloAcademico: r.cicloAcademico,
		}));

		return {
			summary,
			redDetail: summary.filter((r) => r.color === 'ROJO'),
			yellowDetail: summary.filter((r) => r.color === 'AMARILLO'),
			greenDetail: summary.filter((r) => r.color === 'VERDE'),
			metadata: {
				programName: metadata?.programName ?? '',
				commissionName: metadata?.commissionName ?? '',
				academicPeriodCode: metadata?.academicPeriodCode ?? '',
				accreditorCode: metadata?.accreditorCode ?? '',
			},
		};
	}

	private buildFilename(type: 'rc' | 'rv', lang: ReportLanguage): string {
		const prefix = lang === 'en' ? 'Semaphore_Report' : 'Reporte_Semaforo';
		const suffix = type === 'rc' ? 'RC' : 'RV';
		return `${prefix}_${suffix}.pdf`;
	}

	private buildDocument(
		data: SemaphoreReportDto,
		type: 'rc' | 'rv',
		lang: ReportLanguage,
	): ReportDocument {
		const L = SEMAPHORE_PDF_LABELS[lang];
		const reportTitle = type === 'rc' ? L.reportTitleRC : L.reportTitleRV;

		const summaryRows = data.summary
			.map(
				(r) => `
				<tr class="color-${r.color.toLowerCase()}">
					<td>${escapeHtml(r.courseCode)}</td>
					<td>${escapeHtml(r.courseName)}</td>
					<td>${escapeHtml(r.outcomeCode)}</td>
					<td>${escapeHtml(r.outcomeName)}</td>
					<td>${r.totalStudents}</td>
					<td>${r.studentsAchieved}</td>
					<td>${r.percentageAchieved}%</td>
					<td>${escapeHtml(r.sede)}</td>
					<td><span class="semaphore-dot ${r.color.toLowerCase()}"></span>${escapeHtml(r.color)}</td>
				</tr>`,
			)
			.join('');

		const colorBlock = (label: string, items: SemaphoreReportSummaryDto[], colorClass: string) => {
			if (items.length === 0) return '';
			const rows = items
				.map(
					(r) => `
					<tr>
						<td>${escapeHtml(r.courseCode)}</td>
						<td>${escapeHtml(r.courseName)}</td>
						<td>${escapeHtml(r.outcomeCode)}</td>
						<td>${r.percentageAchieved}%</td>
						<td>${r.totalStudents}</td>
						<td>${r.studentsAchieved}</td>
					</tr>`,
				)
				.join('');
			return `
				<section>
					<h4>${escapeHtml(label)} (${items.length})</h4>
					<table>
						<thead><tr><th>${escapeHtml(L.colCourse)}</th><th>${escapeHtml(L.colCourse)}</th><th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colPercentage)}</th><th>${escapeHtml(L.colTotal)}</th><th>${escapeHtml(L.colAchieved)}</th></tr></thead>
						<tbody class="color-${colorClass}">${rows}</tbody>
					</table>
				</section>`;
		};

		const bodyHtml = `
			<section>
				<h3>${escapeHtml(L.summary)}</h3>
				<div class="summary-stats">
					<div class="summary-stat verde"><span class="count">${data.greenDetail.length}</span>${escapeHtml(L.green)}</div>
					<div class="summary-stat amarillo"><span class="count">${data.yellowDetail.length}</span>${escapeHtml(L.yellow)}</div>
					<div class="summary-stat rojo"><span class="count">${data.redDetail.length}</span>${escapeHtml(L.red)}</div>
				</div>
				<table>
					<thead><tr>
						<th>${escapeHtml(L.colCourse)}</th><th>${escapeHtml(L.colCourse)}</th><th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colTotal)}</th><th>${escapeHtml(L.colAchieved)}</th><th>${escapeHtml(L.colPercentage)}</th><th>${escapeHtml(L.colSede)}</th><th>${escapeHtml(L.colColor)}</th>
					</tr></thead>
					<tbody>${summaryRows}</tbody>
				</table>
			</section>
			${colorBlock(L.redDetail, data.redDetail, 'rojo')}
			${colorBlock(L.yellowDetail, data.yellowDetail, 'amarillo')}
			${colorBlock(L.greenDetail, data.greenDetail, 'verde')}
		`;

		return {
			language: lang,
			reportName: reportTitle,
			programName: data.metadata.programName,
			metadata: [
				{ label: L.accreditor, value: data.metadata.accreditorCode },
				{ label: L.commission, value: data.metadata.commissionName },
				{ label: L.academicPeriod, value: data.metadata.academicPeriodCode },
			],
			bodyHtml,
			orientation: 'landscape',
			additionalStyles: SEMAPHORE_REPORT_STYLES,
		};
	}

	private async buildExcel(
		data: SemaphoreReportDto,
		type: 'rc' | 'rv',
		lang: 'es' | 'en',
	): Promise<Buffer> {
		const L = SEMAPHORE_PDF_LABELS[lang];
		const wb = new ExcelJS.Workbook();
		wb.creator = 'ABET System';
		wb.created = new Date();

		const ws = wb.addWorksheet(type === 'rc' ? 'RC' : 'RV');

		const headers = [
			L.colCourse,
			L.colCourse,
			L.colOutcome,
			L.colOutcome,
			L.colTotal,
			L.colAchieved,
			L.colPercentage,
			L.colSede,
			L.colColor,
		];

		ws.columns = headers.map(() => ({ width: 22 }));

		const headerRow = ws.getRow(1);
		headerRow.height = 22;
		headers.forEach((h, idx) => {
			const cell = headerRow.getCell(idx + 1);
			cell.value = h;
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_HEADER_BG } };
			cell.font = { bold: true, color: { argb: XLSX_HEADER_TEXT } };
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = {
				top: { style: 'thin' },
				left: { style: 'thin' },
				right: { style: 'thin' },
				bottom: { style: 'thin' },
			};
		});

		for (const r of data.summary) {
			const row = ws.addRow([
				r.courseCode,
				r.courseName,
				r.outcomeCode,
				r.outcomeName,
				r.totalStudents,
				r.studentsAchieved,
				r.percentageAchieved,
				r.sede,
				r.color,
			]);
			row.eachCell((cell) => {
				cell.border = {
					top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
					left: { style: 'thin', color: { argb: 'FFD4D4D8' } },
					right: { style: 'thin', color: { argb: 'FFD4D4D8' } },
					bottom: { style: 'thin', color: { argb: 'FFD4D4D8' } },
				};
				cell.alignment = { vertical: 'top', wrapText: true };
			});
		}

		ws.views = [{ state: 'frozen', ySplit: 1 }];
		return Buffer.from(await wb.xlsx.writeBuffer());
	}
}
