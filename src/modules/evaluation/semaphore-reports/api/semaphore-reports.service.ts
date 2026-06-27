import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ReportGeneratorService } from 'src/libs/reporting/report-generator.service';
import type { ReportDocument, ReportLanguage } from 'src/libs/reporting/report.types';
import { escapeHtml } from 'src/libs/reporting/report.utils';
import {
	SemaphoreReportsRepository,
	SemaphoreCourseOutcomeRow,
	SemaphoreDetailRow,
	SemaphoreSummaryRow,
	SemaphoreLevelLegendRow,
	MetadataRow,
} from '../core/semaphore-reports.repository';
import { SEMAPHORE_PDF_LABELS, SEMAPHORE_REPORT_STYLES } from './semaphore-pdf.theme';
import { semaphoreReportsValidationStrings } from '../config/strings/semaphore-reports.validation';
import type {
	SemaphoreFilterDto,
	SemaphoreReportDto,
	SemaphoreCourseOutcomeSummaryDto,
	SemaphoreCourseDetailRowDto,
	SemaphoreOutcomeSummaryRowDto,
	SemaphoreLevelLegendDto,
} from '../model/semaphore-reports.dtos';
import * as ExcelJS from 'exceljs';

const XLSX_HEADER_BG = 'FFE30613';
const XLSX_HEADER_TEXT = 'FFFFFFFF';
const CRITICAL_RED_THRESHOLD = 23;

interface SemaphoreRenderReportDto {
	legend: SemaphoreLevelLegendDto[];
	outcomeSummary: SemaphoreOutcomeSummaryRowDto[];
	redDetail: SemaphoreCourseDetailRowDto[];
	yellowDetail: SemaphoreCourseDetailRowDto[];
	greenDetail: SemaphoreCourseDetailRowDto[];
	metadata: SemaphoreReportDto['metadata'];
}

@Injectable()
export class SemaphoreReportsService {
	private readonly logger = new Logger(SemaphoreReportsService.name);

	constructor(
		private readonly repository: SemaphoreReportsRepository,
		private readonly reportGenerator: ReportGeneratorService,
	) {}

	async getRcData(dto: SemaphoreFilterDto, academicPeriodId: number): Promise<SemaphoreReportDto> {
		return this.getScreenData(dto, academicPeriodId, 'rc');
	}

	async getRvData(dto: SemaphoreFilterDto, academicPeriodId: number): Promise<SemaphoreReportDto> {
		return this.getScreenData(dto, academicPeriodId, 'rv');
	}

	async generateRcPdf(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
	): Promise<{ pdf: Buffer; filename: string }> {
		const lang = (dto.lang ?? 'es') as ReportLanguage;
		const data = await this.fetchRenderData(dto, academicPeriodId, 'rc');
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
		const data = await this.fetchRenderData(dto, academicPeriodId, 'rv');
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
		const data = await this.fetchRenderData(dto, academicPeriodId, 'rc');
		const xlsx = await this.buildExcel(data, 'rc', lang);
		const filename = `Reporte_Semaforo_RC_${Date.now()}.xlsx`;
		return { xlsx, filename };
	}

	async generateRvExcel(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
	): Promise<{ xlsx: Buffer; filename: string }> {
		const lang = (dto.lang ?? 'es') as 'es' | 'en';
		const data = await this.fetchRenderData(dto, academicPeriodId, 'rv');
		const xlsx = await this.buildExcel(data, 'rv', lang);
		const filename = `Reporte_Semaforo_RV_${Date.now()}.xlsx`;
		return { xlsx, filename };
	}

	/** JSON for the screen: full, unfiltered course+outcome breakdown. */
	private async getScreenData(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
		instrument: 'rc' | 'rv',
	): Promise<SemaphoreReportDto> {
		const lang = dto.lang ?? 'es';
		const programCommissionId = dto.programCommissionId ?? null;
		const outcomeId = dto.outcomeId ?? null;
		const campusId = dto.campusId ?? null;
		const modalityTypeId = dto.modalityTypeId ?? null;

		const getScreen =
			instrument === 'rc' ? this.repository.getRcScreen : this.repository.getRvScreen;
		const rows = await getScreen.call(
			this.repository,
			academicPeriodId,
			programCommissionId,
			outcomeId,
			campusId,
			modalityTypeId,
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
		const legendRows = await this.repository.getLevelsLegend(academicPeriodId, instrument, lang);
		const metadata = await this.repository.getMetadata(programCommissionId, academicPeriodId, lang);
		return this.buildScreenReport(rows, legendRows, metadata);
	}

	/** Data for PDF/Excel: replicates the legacy critical/representative filtering. */
	private async fetchRenderData(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
		instrument: 'rc' | 'rv',
	): Promise<SemaphoreRenderReportDto> {
		const lang = dto.lang ?? 'es';
		const programCommissionId = dto.programCommissionId ?? null;
		const outcomeId = dto.outcomeId ?? null;
		const campusId = dto.campusId ?? null;
		const modalityTypeId = dto.modalityTypeId ?? null;

		const getDetail =
			instrument === 'rc' ? this.repository.getRcDetail : this.repository.getRvDetail;
		const getSummary =
			instrument === 'rc' ? this.repository.getRcSummary : this.repository.getRvSummary;

		const detailRows = await getDetail.call(
			this.repository,
			academicPeriodId,
			programCommissionId,
			outcomeId,
			campusId,
			modalityTypeId,
			lang,
		);
		if (detailRows.length === 0) {
			throw new HttpException(
				{
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.noData],
				},
				HttpStatus.NOT_FOUND,
			);
		}
		const summaryRows = await getSummary.call(
			this.repository,
			academicPeriodId,
			programCommissionId,
			outcomeId,
			campusId,
			modalityTypeId,
			lang,
		);
		const legendRows = await this.repository.getLevelsLegend(academicPeriodId, instrument, lang);
		const metadata = await this.repository.getMetadata(programCommissionId, academicPeriodId, lang);
		return this.buildRenderReport(detailRows, summaryRows, legendRows, metadata);
	}

	private buildLegend(legendRows: SemaphoreLevelLegendRow[]): SemaphoreLevelLegendDto[] {
		return legendRows.map((r) => ({
			name: r.name,
			minScore: Number(r.minScore),
			maxScore: Number(r.maxScore),
			color: r.color,
		}));
	}

	private buildScreenReport(
		rows: SemaphoreCourseOutcomeRow[],
		legendRows: SemaphoreLevelLegendRow[],
		metadata: MetadataRow | null,
	): SemaphoreReportDto {
		const legend = this.buildLegend(legendRows);
		const levelColor = (rank: number): string => legend[rank]?.color ?? '#6b7280';

		const summary: SemaphoreCourseOutcomeSummaryDto[] = rows.map((r) => {
			const total = Number(r.totalStudents);
			const studentsRed = Number(r.studentsRed);
			const studentsYellow = Number(r.studentsYellow);
			const studentsGreen = Number(r.studentsGreen);
			const percentageRed = total > 0 ? Math.round((studentsRed / total) * 10000) / 100 : 0;
			const percentageYellow = total > 0 ? Math.round((studentsYellow / total) * 10000) / 100 : 0;
			const percentageGreen = total > 0 ? Math.round((studentsGreen / total) * 10000) / 100 : 0;
			const isCritical = percentageRed >= CRITICAL_RED_THRESHOLD;
			const color = isCritical
				? levelColor(0)
				: studentsGreen >= studentsYellow
					? levelColor(2)
					: levelColor(1);

			return {
				sede: r.sede,
				cicloAcademico: r.cicloAcademico,
				courseCode: r.courseCode,
				courseName: r.courseName,
				outcomeCode: r.outcomeCode,
				outcomeName: r.outcomeName,
				totalStudents: total,
				studentsRed,
				studentsYellow,
				studentsGreen,
				percentageRed,
				percentageYellow,
				percentageGreen,
				isCritical,
				color,
			};
		});

		return {
			legend,
			summary,
			metadata: {
				programName: metadata?.programName ?? '',
				commissionName: metadata?.commissionName ?? '',
				academicPeriodCode: metadata?.academicPeriodCode ?? '',
				accreditorCode: metadata?.accreditorCode ?? '',
			},
		};
	}

	private buildRenderReport(
		detailRows: SemaphoreDetailRow[],
		summaryRows: SemaphoreSummaryRow[],
		legendRows: SemaphoreLevelLegendRow[],
		metadata: MetadataRow | null,
	): SemaphoreRenderReportDto {
		const legend = this.buildLegend(legendRows);
		const levelName = (rank: number): string => legend[rank - 1]?.name ?? '';
		const levelColor = (rank: number): string => legend[rank - 1]?.color ?? '#6b7280';

		const outcomeSummary: SemaphoreOutcomeSummaryRowDto[] = summaryRows.map((r) => ({
			sede: r.sede,
			outcomeCode: r.outcomeCode,
			outcomeName: r.outcomeName,
			totalStudents: Number(r.totalStudents),
			levelName: levelName(Number(r.levelRank)),
			count: Number(r.cantidad),
			percentage: Number(r.porcentaje),
			color: levelColor(Number(r.levelRank)),
		}));

		const toDetailRow = (r: SemaphoreDetailRow): SemaphoreCourseDetailRowDto => ({
			sede: r.sede,
			outcomeCode: r.outcomeCode,
			outcomeName: r.outcomeName,
			courseCode: r.courseCode,
			courseName: r.courseName,
			count: Number(r.cantidad),
			totalStudents: Number(r.totalStudents),
		});

		return {
			legend,
			outcomeSummary,
			redDetail: detailRows.filter((r) => Number(r.levelRank) === 1).map(toDetailRow),
			yellowDetail: detailRows.filter((r) => Number(r.levelRank) === 2).map(toDetailRow),
			greenDetail: detailRows.filter((r) => Number(r.levelRank) === 3).map(toDetailRow),
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
		data: SemaphoreRenderReportDto,
		type: 'rc' | 'rv',
		lang: ReportLanguage,
	): ReportDocument {
		const L = SEMAPHORE_PDF_LABELS[lang];
		const reportTitle = type === 'rc' ? L.reportTitleRC : L.reportTitleRV;

		const legendLine = data.legend
			.map(
				(lv) => `
				<span class="legend-item">
					<span class="semaphore-dot" style="background-color:${escapeHtml(lv.color)}"></span>
					${escapeHtml(lv.name)} [${lv.minScore} - ${lv.maxScore}]
				</span>`,
			)
			.join('');

		const summaryRows = data.outcomeSummary
			.map(
				(r) => `
				<tr style="background-color:${escapeHtml(r.color)}">
					<td>${escapeHtml(r.sede)}</td>
					<td>${escapeHtml(r.outcomeCode)}</td>
					<td>${escapeHtml(r.outcomeName)}</td>
					<td>${r.totalStudents}</td>
					<td>${r.count}</td>
					<td>${r.percentage}%</td>
				</tr>`,
			)
			.join('');

		const detailBlock = (label: string, items: SemaphoreCourseDetailRowDto[]) => {
			if (items.length === 0) return '';
			const rows = items
				.map(
					(r) => `
					<tr>
						<td>${escapeHtml(r.sede)}</td>
						<td>${escapeHtml(r.outcomeCode)}</td>
						<td>${escapeHtml(r.outcomeName)}</td>
						<td>${escapeHtml(r.courseCode)}</td>
						<td>${escapeHtml(r.courseName) || L.noTranslation}</td>
						<td>${r.count}</td>
						<td>${r.totalStudents}</td>
					</tr>`,
				)
				.join('');
			return `
				<section>
					<h4>${escapeHtml(label)} (${items.length})</h4>
					<table>
						<thead><tr>
							<th>${escapeHtml(L.colSede)}</th><th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colCode)}</th><th>${escapeHtml(L.colCourse)}</th><th>${escapeHtml(L.colQuantity)}</th><th>${escapeHtml(L.colTotalStudentsByOutcome)}</th>
						</tr></thead>
						<tbody>${rows}</tbody>
					</table>
				</section>`;
		};

		const bodyHtml = `
			<section>
				<h3>${escapeHtml(L.legendTitle)}</h3>
				<div class="legend-line">${legendLine}</div>
			</section>
			<section>
				<h3>${escapeHtml(L.summary)}</h3>
				<table>
					<thead><tr>
						<th>${escapeHtml(L.colSede)}</th><th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colTotalStudents)}</th><th>${escapeHtml(L.colQuantity)}</th><th>${escapeHtml(L.colPercentage)}</th>
					</tr></thead>
					<tbody>${summaryRows}</tbody>
				</table>
			</section>
			${detailBlock(L.redDetail, data.redDetail)}
			${detailBlock(L.yellowDetail, data.yellowDetail)}
			${detailBlock(L.greenDetail, data.greenDetail)}
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
		data: SemaphoreRenderReportDto,
		type: 'rc' | 'rv',
		lang: 'es' | 'en',
	): Promise<Buffer> {
		const L = SEMAPHORE_PDF_LABELS[lang];
		const wb = new ExcelJS.Workbook();
		wb.creator = 'ABET System';
		wb.created = new Date();

		const summarySheet = wb.addWorksheet(type === 'rc' ? 'RC - Resumen' : 'RV - Resumen');
		const summaryHeaders = [
			L.colSede,
			L.colOutcome,
			L.colOutcome,
			L.colTotalStudents,
			L.colQuantity,
			L.colPercentage,
		];
		this.writeExcelHeader(summarySheet, summaryHeaders);
		for (const r of data.outcomeSummary) {
			const row = summarySheet.addRow([
				r.sede,
				r.outcomeCode,
				r.outcomeName,
				r.totalStudents,
				r.count,
				r.percentage,
			]);
			this.styleExcelRow(row);
			row.eachCell((cell) => {
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: this.hexToArgb(r.color) },
				};
			});
		}
		summarySheet.views = [{ state: 'frozen', ySplit: 1 }];

		const detailHeaders = [
			L.colSede,
			L.colOutcome,
			L.colOutcome,
			L.colCode,
			L.colCourse,
			L.colQuantity,
			L.colTotalStudentsByOutcome,
		];
		const addDetailSheet = (name: string, items: SemaphoreCourseDetailRowDto[]) => {
			const sheet = wb.addWorksheet(name);
			this.writeExcelHeader(sheet, detailHeaders);
			for (const r of items) {
				const row = sheet.addRow([
					r.sede,
					r.outcomeCode,
					r.outcomeName,
					r.courseCode,
					r.courseName || L.noTranslation,
					r.count,
					r.totalStudents,
				]);
				this.styleExcelRow(row);
			}
			sheet.views = [{ state: 'frozen', ySplit: 1 }];
		};

		addDetailSheet(L.redDetail.slice(0, 31), data.redDetail);
		addDetailSheet(L.yellowDetail.slice(0, 31), data.yellowDetail);
		addDetailSheet(L.greenDetail.slice(0, 31), data.greenDetail);

		return Buffer.from(await wb.xlsx.writeBuffer());
	}

	private hexToArgb(hex: string): string {
		const clean = hex.replace('#', '');
		return `FF${clean.length === 6 ? clean.toUpperCase() : 'FFFFFF'}`;
	}

	private writeExcelHeader(ws: ExcelJS.Worksheet, headers: string[]): void {
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
	}

	private styleExcelRow(row: ExcelJS.Row): void {
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
}
