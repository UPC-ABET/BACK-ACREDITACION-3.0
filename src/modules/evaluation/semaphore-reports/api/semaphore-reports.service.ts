import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ReportChartService } from 'src/libs/reporting/report-chart.service';
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
	SemaphoreCampusRow,
} from '../core/semaphore-reports.repository';
import { SEMAPHORE_PDF_LABELS, SEMAPHORE_REPORT_STYLES } from './semaphore-pdf.theme';
import { semaphoreReportsValidationStrings } from '../config/strings/semaphore-reports.validation';
import type {
	SemaphoreFilterDto,
	SemaphoreReportDto,
	SemaphoreCourseOutcomeSummaryDto,
	SemaphoreCourseDetailRowDto,
	SemaphoreOutcomePivotRowDto,
	SemaphoreOutcomeSummaryRowDto,
	SemaphoreLevelLegendDto,
	SemaphoreConsolidatedGroupDto,
} from '../model/semaphore-reports.dtos';
import * as ExcelJS from 'exceljs';

const XLSX_HEADER_BG = 'FFE30613';
const XLSX_HEADER_TEXT = 'FFFFFFFF';
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CRITICAL_RED_THRESHOLD = 23;
const PG_QUERY_CANCELED = '57014';

interface SemaphoreChartData {
	categories: string[];
	series: { label: string; color: string; values: number[] }[];
}

interface SemaphoreRenderReportDto {
	legend: SemaphoreLevelLegendDto[];
	chart: SemaphoreChartData;
	outcomePivot: SemaphoreOutcomePivotRowDto[];
	outcomeSummary: SemaphoreOutcomeSummaryRowDto[];
	consolidated: SemaphoreConsolidatedGroupDto[];
	redDetail: SemaphoreCourseDetailRowDto[];
	yellowDetail: SemaphoreCourseDetailRowDto[];
	greenDetail: SemaphoreCourseDetailRowDto[];
	metadata: SemaphoreReportDto['metadata'];
}

/** What the download endpoints hand the controller. */
interface SemaphoreDownload {
	buffer: Buffer;
	filename: string;
	contentType: string;
}

/**
 * How a campus selection resolves for a download (see docs/CONTEXT.md's report business rules):
 *  - 'all': no campus filter -- one consolidated report with every campus's data.
 *  - 'single': exactly one campus selected -- one report scoped to it.
 *
 * There is deliberately no multi-campus arm: a document holding one section per selected campus
 * times the selected outcomes is not readable, so more than one id is rejected outright.
 */
type SemaphoreCampusPlan = { mode: 'all' } | { mode: 'single'; campus: SemaphoreCampusRow };

/** Sorts codes the way a reader expects ('2' before '10'), for outcome and course codes alike. */
const compareCodes = (a: string, b: string): number =>
	a.localeCompare(b, undefined, { numeric: true });

@Injectable()
export class SemaphoreReportsService {
	private readonly logger = new Logger(SemaphoreReportsService.name);

	constructor(
		private readonly repository: SemaphoreReportsRepository,
		private readonly reportGenerator: ReportGeneratorService,
		private readonly reportChart: ReportChartService,
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
	): Promise<SemaphoreDownload> {
		return this.generatePdfDownload(dto, academicPeriodId, 'rc');
	}

	async generateRvPdf(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
	): Promise<SemaphoreDownload> {
		return this.generatePdfDownload(dto, academicPeriodId, 'rv');
	}

	async generateRcExcel(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
	): Promise<SemaphoreDownload> {
		return this.generateExcelDownload(dto, academicPeriodId, 'rc');
	}

	async generateRvExcel(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
	): Promise<SemaphoreDownload> {
		return this.generateExcelDownload(dto, academicPeriodId, 'rv');
	}

	/**
	 * Campus-selection-aware PDF download: one consolidated report over every campus, or one
	 * scoped to the single selected campus -- see `SemaphoreCampusPlan`.
	 */
	private async generatePdfDownload(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
		instrument: 'rc' | 'rv',
	): Promise<SemaphoreDownload> {
		const lang = (dto.lang ?? 'es') as ReportLanguage;
		const plan = await this.resolveCampusPlan(dto.campusIds, lang);
		const campusIds = plan.mode === 'single' ? [plan.campus.id] : null;
		const campusLabel =
			plan.mode === 'single' ? plan.campus.name : SEMAPHORE_PDF_LABELS[lang].allCampuses;

		const data = await this.fetchRenderData(dto, academicPeriodId, instrument, campusIds);
		const { pdf, filename } = await this.reportGenerator.generateDocument(
			this.buildDocument(data, instrument, lang, campusLabel),
			this.buildFilename(instrument, lang, plan.mode === 'single' ? plan.campus.code : undefined),
		);
		return { buffer: pdf, filename, contentType: 'application/pdf' };
	}

	/** Same campus-selection rules as `generatePdfDownload`, but rendering XLSX workbooks. */
	private async generateExcelDownload(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
		instrument: 'rc' | 'rv',
	): Promise<SemaphoreDownload> {
		const lang = (dto.lang ?? 'es') as 'es' | 'en';
		const plan = await this.resolveCampusPlan(dto.campusIds, lang);
		const campusIds = plan.mode === 'single' ? [plan.campus.id] : null;
		const campusLabel =
			plan.mode === 'single' ? plan.campus.name : SEMAPHORE_PDF_LABELS[lang].allCampuses;

		const data = await this.fetchRenderData(dto, academicPeriodId, instrument, campusIds);
		const xlsx = await this.renderExcel(data, instrument, lang, campusLabel);
		return {
			buffer: xlsx,
			filename: this.buildExcelFilename(
				instrument,
				lang,
				plan.mode === 'single' ? plan.campus.code : undefined,
			),
			contentType: XLSX_CONTENT_TYPE,
		};
	}

	private throwNoData(): never {
		throw new HttpException(
			{
				message: semaphoreReportsValidationStrings.result.generateFailed,
				errors: [semaphoreReportsValidationStrings.error.noData],
			},
			HttpStatus.NOT_FOUND,
		);
	}

	/**
	 * Resolves a requested campus selection against the active campus catalog. An empty/omitted
	 * selection means "all" -- one consolidated report. Anything past a single campus is refused
	 * before the catalog is even read, so an over-broad selection costs no query.
	 */
	private async resolveCampusPlan(
		campusIds: number[] | undefined,
		lang: string,
	): Promise<SemaphoreCampusPlan> {
		const requested = campusIds?.length ? [...new Set(campusIds)] : null;
		if (!requested) return { mode: 'all' };
		if (requested.length > 1) {
			throw new HttpException(
				{
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.singleCampusRequired],
				},
				HttpStatus.BAD_REQUEST,
			);
		}

		const allCampuses = await this.runQuery(() => this.repository.getCampuses(lang));
		const campus = allCampuses.find((candidate) => candidate.id === requested[0]);
		if (!campus) this.throwNoData();
		return { mode: 'single', campus };
	}

	/**
	 * Turns a failed report read into a typed HTTP answer. Postgres reports a `statement_timeout`
	 * cancellation as SQLSTATE 57014, which is a "too heavy right now, retry" condition rather than
	 * a bug -- reporting it as a bare 500 leaves the client with nothing actionable.
	 */
	private async runQuery<T>(read: () => Promise<T>): Promise<T> {
		try {
			return await read();
		} catch (error) {
			const code = (error as { code?: string })?.code;
			if (code === PG_QUERY_CANCELED) {
				this.logger.error('Semaphore report query hit statement_timeout');
				throw new HttpException(
					{
						message: semaphoreReportsValidationStrings.result.generateFailed,
						errors: [semaphoreReportsValidationStrings.error.queryTimeout],
					},
					HttpStatus.SERVICE_UNAVAILABLE,
				);
			}
			this.logger.error(
				`Semaphore report query failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw new HttpException(
				{
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.queryFailed],
				},
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
	}

	/** JSON for the screen: full, unfiltered course+outcome breakdown. */
	private async getScreenData(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
		instrument: 'rc' | 'rv',
	): Promise<SemaphoreReportDto> {
		const lang = dto.lang ?? 'es';
		const programCommissionId = dto.programCommissionId ?? null;
		const campusIds = dto.campusIds?.length ? dto.campusIds : null;
		const rubricIds = dto.rubricIds?.length ? dto.rubricIds : null;
		const gradeTypeIds = dto.gradeTypeIds?.length ? dto.gradeTypeIds : null;

		const rows = await this.runQuery(() =>
			instrument === 'rc'
				? this.repository.getRcScreen(academicPeriodId, programCommissionId, campusIds, lang)
				: this.repository.getRvScreen(
						academicPeriodId,
						programCommissionId,
						campusIds,
						lang,
						rubricIds,
						gradeTypeIds,
					),
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
		const [legendRows, metadata] = await this.runQuery(() =>
			Promise.all([
				this.repository.getLevelsLegend(academicPeriodId, instrument, lang),
				this.repository.getMetadata(programCommissionId, academicPeriodId, lang),
			]),
		);
		return this.buildScreenReport(rows, legendRows, metadata);
	}

	/**
	 * Data for PDF/Excel: replicates the legacy critical/representative filtering. `campusIds` is
	 * resolved by the caller (`resolveCampusPlan`), not read off `dto` -- `null` for the
	 * consolidated report, a one-element array for a campus-scoped one.
	 */
	private async fetchRenderData(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
		instrument: 'rc' | 'rv',
		campusIds: number[] | null,
	): Promise<SemaphoreRenderReportDto> {
		const { detailRows, summaryRows, screenRows } = await this.fetchRenderRows(
			dto,
			academicPeriodId,
			instrument,
			campusIds,
		);
		if (detailRows.length === 0) this.throwNoData();
		const [legendRows, metadata] = await this.fetchLegendAndMetadata(
			dto,
			academicPeriodId,
			instrument,
		);
		return this.buildRenderReport(
			detailRows,
			summaryRows,
			screenRows,
			legendRows,
			metadata,
			(dto.lang ?? 'es') as ReportLanguage,
			instrument,
		);
	}

	/** The three heavy report queries (detail/summary/screen), run once. */
	private async fetchRenderRows(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
		instrument: 'rc' | 'rv',
		campusIds: number[] | null,
	): Promise<{
		detailRows: SemaphoreDetailRow[];
		summaryRows: SemaphoreSummaryRow[];
		screenRows: SemaphoreCourseOutcomeRow[];
	}> {
		const lang = dto.lang ?? 'es';
		const programCommissionId = dto.programCommissionId ?? null;
		const rubricIds = dto.rubricIds?.length ? dto.rubricIds : null;
		const gradeTypeIds = dto.gradeTypeIds?.length ? dto.gradeTypeIds : null;

		// Detail, summary and the (unfiltered, chart-feeding) screen breakdown each re-derive the same
		// expensive base CTE, so running them concurrently cuts the wait to the slowest one instead of
		// their sum. Three is also the ceiling this report may take from a pool shared app-wide.
		const [detailRows, summaryRows, screenRows] = await this.runQuery(() =>
			Promise.all(
				instrument === 'rc'
					? ([
							this.repository.getRcDetail(academicPeriodId, programCommissionId, campusIds, lang),
							this.repository.getRcSummary(academicPeriodId, programCommissionId, campusIds, lang),
							this.repository.getRcScreen(academicPeriodId, programCommissionId, campusIds, lang),
						] as const)
					: ([
							this.repository.getRvDetail(
								academicPeriodId,
								programCommissionId,
								campusIds,
								lang,
								rubricIds,
								gradeTypeIds,
							),
							this.repository.getRvSummary(
								academicPeriodId,
								programCommissionId,
								campusIds,
								lang,
								rubricIds,
								gradeTypeIds,
							),
							this.repository.getRvScreen(
								academicPeriodId,
								programCommissionId,
								campusIds,
								lang,
								rubricIds,
								gradeTypeIds,
							),
						] as const),
			),
		);
		return { detailRows, summaryRows, screenRows };
	}

	/** Legend and metadata are campus-independent (period+instrument, and program-commission,
	 *  scoped respectively), so they are fetched once per report regardless of the campus plan. */
	private async fetchLegendAndMetadata(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
		instrument: 'rc' | 'rv',
	): Promise<[SemaphoreLevelLegendRow[], MetadataRow | null]> {
		const lang = dto.lang ?? 'es';
		const programCommissionId = dto.programCommissionId ?? null;
		return this.runQuery(() =>
			Promise.all([
				this.repository.getLevelsLegend(academicPeriodId, instrument, lang),
				this.repository.getMetadata(programCommissionId, academicPeriodId, lang),
			]),
		);
	}

	/** Sums red/yellow/green student counts per outcome across every course and campus in the
	 *  (unfiltered) screen rows -- shared by the PDF chart and the pivoted RV summary table. */
	private aggregateOutcomeCounts(screenRows: SemaphoreCourseOutcomeRow[]): {
		code: string;
		name: string;
		description: string;
		red: number;
		yellow: number;
		green: number;
		total: number;
	}[] {
		const byOutcome = new Map<
			string,
			{
				name: string;
				description: string;
				red: number;
				yellow: number;
				green: number;
				total: number;
			}
		>();
		for (const r of screenRows) {
			const entry = byOutcome.get(r.outcomeCode) ?? {
				name: r.outcomeName,
				description: r.outcomeDescription || r.outcomeName,
				red: 0,
				yellow: 0,
				green: 0,
				total: 0,
			};
			entry.red += Number(r.studentsRed);
			entry.yellow += Number(r.studentsYellow);
			entry.green += Number(r.studentsGreen);
			entry.total += Number(r.totalStudents);
			byOutcome.set(r.outcomeCode, entry);
		}
		const codes = [...byOutcome.keys()].sort(compareCodes);
		return codes.map((code) => ({ code, ...byOutcome.get(code)! }));
	}

	/** Aggregates red/yellow/green student counts per outcome for the PDF chart. */
	private buildOutcomeChartData(
		screenRows: SemaphoreCourseOutcomeRow[],
		legend: SemaphoreLevelLegendDto[],
		lang: ReportLanguage,
		instrument: 'rc' | 'rv',
	): SemaphoreChartData {
		const L = SEMAPHORE_PDF_LABELS[lang];
		const entries = this.aggregateOutcomeCounts(screenRows);
		const color = (rank: number, fallback: string): string => legend[rank]?.color ?? fallback;
		// The chart's own legend carries the acceptance-level range, so no separate "Niveles de
		// Aceptación" section is needed elsewhere in the document. Scores always render with 1
		// decimal, truncated (not rounded) -- a stored boundary like 15.999999 must read as
		// "15.9", never "16.0": rounding up would claim a score of 15.95 already qualifies for
		// the next level, which the actual stored boundary does not allow.
		const round1 = (value: number): string => (Math.trunc(value * 10) / 10).toFixed(1);
		const seriesLabel = (rank: number, fallback: string): string => {
			const lv = legend[rank];
			const name = lv?.name ?? fallback;
			const range = lv ? ` [${round1(lv.minScore)} - ${round1(lv.maxScore)}]` : '';
			return `${name}${range}`;
		};
		return {
			// RV shows the reader-facing outcome name (e.g. "1", "2") rather than the internal
			// accreditor code (e.g. "EAC-SI-2"); RC keeps the code, unchanged.
			categories: entries.map((e) => (instrument === 'rv' ? e.name : e.code)),
			series: [
				{
					label: seriesLabel(0, L.redDetail),
					color: color(0, '#e30613'),
					values: entries.map((e) => e.red),
				},
				{
					label: seriesLabel(1, L.yellowDetail),
					color: color(1, '#f4c20d'),
					values: entries.map((e) => e.yellow),
				},
				{
					label: seriesLabel(2, L.greenDetail),
					color: color(2, '#16a34a'),
					values: entries.map((e) => e.green),
				},
			],
		};
	}

	/** One row per outcome, with a count+percentage cell per acceptance level -- the RV
	 *  "Reporte de Verificación Consolidado" table shape (Outcome | Descripción | level columns |
	 *  Total). */
	private buildOutcomePivot(
		screenRows: SemaphoreCourseOutcomeRow[],
		legend: SemaphoreLevelLegendDto[],
	): SemaphoreOutcomePivotRowDto[] {
		const entries = this.aggregateOutcomeCounts(screenRows);
		const level = (rank: number, count: number, total: number, fallback: string) => ({
			name: legend[rank]?.name ?? fallback,
			color: legend[rank]?.color ?? '#6b7280',
			count,
			percentage: this.toPercentage(count, total),
		});
		return entries.map((e) => ({
			outcomeCode: e.code,
			outcomeName: e.name,
			outcomeDescription: e.description,
			totalStudents: e.total,
			levels: [
				level(0, e.red, e.total, 'Necesita mejora'),
				level(1, e.yellow, e.total, 'Esperado'),
				level(2, e.green, e.total, 'Sobresaliente'),
			],
		}));
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
			const percentageRed = this.toPercentage(studentsRed, total);
			const percentageYellow = this.toPercentage(studentsYellow, total);
			const percentageGreen = this.toPercentage(studentsGreen, total);
			const isCritical = percentageRed >= CRITICAL_RED_THRESHOLD;
			const color = isCritical
				? levelColor(0)
				: studentsGreen >= studentsYellow
					? levelColor(2)
					: levelColor(1);

			return {
				campus: r.campus,
				academicPeriodCycle: r.academicPeriodCycle,
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
				modalityName: metadata?.modalityName ?? '',
				commissionName: metadata?.commissionName ?? '',
				academicPeriodCode: metadata?.academicPeriodCode ?? '',
				accreditorCode: metadata?.accreditorCode ?? '',
			},
		};
	}

	private buildRenderReport(
		detailRows: SemaphoreDetailRow[],
		summaryRows: SemaphoreSummaryRow[],
		screenRows: SemaphoreCourseOutcomeRow[],
		legendRows: SemaphoreLevelLegendRow[],
		metadata: MetadataRow | null,
		lang: ReportLanguage = 'es',
		instrument: 'rc' | 'rv' = 'rc',
	): SemaphoreRenderReportDto {
		const legend = this.buildLegend(legendRows);
		const levelName = (rank: number): string => legend[rank - 1]?.name ?? '';
		const levelColor = (rank: number): string => legend[rank - 1]?.color ?? '#6b7280';

		// Feeds RC's "Resumen por Outcome" table (critical outcomes only, from `getRcSummary`'s
		// representative-row filtering) -- see `buildSummarySection`. RV no longer renders this
		// table (replaced by the full pivot below), but the row shape is still built here so a
		// future RV consumer of the JSON/Excel path is not surprised by a missing field.
		const outcomeSummary: SemaphoreOutcomeSummaryRowDto[] = summaryRows.map((r) => ({
			campus: r.campus,
			outcomeCode: r.outcomeCode,
			outcomeName: r.outcomeName,
			totalStudents: Number(r.totalStudents),
			levelName: levelName(Number(r.levelRank)),
			count: Number(r.quantity),
			percentage: Number(r.percentage),
			color: levelColor(Number(r.levelRank)),
		}));

		const toDetailRow = (r: SemaphoreDetailRow): SemaphoreCourseDetailRowDto => ({
			campus: r.campus,
			outcomeCode: r.outcomeCode,
			outcomeName: r.outcomeName,
			courseCode: r.courseCode,
			courseName: r.courseName,
			count: Number(r.quantity),
			totalStudents: Number(r.totalStudents),
			percentage: Number(r.percentage),
		});

		return {
			legend,
			chart: this.buildOutcomeChartData(screenRows, legend, lang, instrument),
			outcomePivot: this.buildOutcomePivot(screenRows, legend),
			outcomeSummary,
			consolidated: this.buildConsolidatedGroups(screenRows),
			redDetail: detailRows.filter((r) => Number(r.levelRank) === 1).map(toDetailRow),
			yellowDetail: detailRows.filter((r) => Number(r.levelRank) === 2).map(toDetailRow),
			greenDetail: detailRows.filter((r) => Number(r.levelRank) === 3).map(toDetailRow),
			metadata: {
				programName: metadata?.programName ?? '',
				modalityName: metadata?.modalityName ?? '',
				commissionName: metadata?.commissionName ?? '',
				academicPeriodCode: metadata?.academicPeriodCode ?? '',
				accreditorCode: metadata?.accreditorCode ?? '',
			},
		};
	}

	/**
	 * Collapses the per-`(course, outcome, campus)` screen rows into the consolidated RC table:
	 * one block per outcome, one row per course inside it, and a totals line.
	 *
	 * The consolidated report (no campus filter) returns the same course once per campus, so the
	 * counts are summed across campuses before the percentage is taken -- `Σcount / Σtotal`, never
	 * an average of per-campus percentages, which would weight a 3-student campus like a
	 * 300-student one.
	 *
	 * The three buckets are fixed: the report SQL classifies every grade into `level_rank` 1|2|3.
	 * A grade outside every configured level lands in none of them, so the three counts can sum to
	 * less than `totalStudents` -- visible, deliberately, in the totals row.
	 */
	private buildConsolidatedGroups(
		screenRows: SemaphoreCourseOutcomeRow[],
	): SemaphoreConsolidatedGroupDto[] {
		interface Accumulator {
			outcomeCode: string;
			outcomeName: string;
			courseCode: string;
			courseName: string;
			counts: number[];
			totalStudents: number;
		}

		const byCourse = new Map<string, Accumulator>();
		for (const row of screenRows) {
			const key = `${row.outcomeCode} ${row.courseCode}`;
			const entry = byCourse.get(key) ?? {
				outcomeCode: row.outcomeCode,
				outcomeName: row.outcomeName,
				courseCode: row.courseCode,
				courseName: row.courseName,
				counts: [0, 0, 0],
				totalStudents: 0,
			};
			entry.counts[0] += Number(row.studentsRed);
			entry.counts[1] += Number(row.studentsYellow);
			entry.counts[2] += Number(row.studentsGreen);
			entry.totalStudents += Number(row.totalStudents);
			byCourse.set(key, entry);
		}

		const groups = new Map<string, SemaphoreConsolidatedGroupDto>();
		for (const entry of [...byCourse.values()].sort(
			(a, b) =>
				compareCodes(a.outcomeCode, b.outcomeCode) || compareCodes(a.courseCode, b.courseCode),
		)) {
			const group = groups.get(entry.outcomeCode) ?? {
				outcomeCode: entry.outcomeCode,
				outcomeName: entry.outcomeName,
				rows: [],
				levelTotals: [0, 0, 0],
				totalStudents: 0,
			};
			group.rows.push({
				courseCode: entry.courseCode,
				courseName: entry.courseName,
				levels: entry.counts.map((count) => ({
					count,
					percentage: this.toPercentage(count, entry.totalStudents),
				})),
				totalStudents: entry.totalStudents,
			});
			group.levelTotals = group.levelTotals.map((total, index) => total + entry.counts[index]);
			group.totalStudents += entry.totalStudents;
			groups.set(entry.outcomeCode, group);
		}

		return [...groups.values()];
	}

	private toPercentage(count: number, total: number): number {
		return total > 0 ? Math.round((count / total) * 10000) / 100 : 0;
	}

	private reportBaseName(type: 'rc' | 'rv', lang: 'es' | 'en'): string {
		const prefix = lang === 'en' ? 'Report' : 'Reporte';
		const suffix =
			type === 'rc' ? 'Control_RC' : lang === 'en' ? 'Verification_RV' : 'Verificacion_RV';
		return `${prefix}_${suffix}`;
	}

	private buildFilename(type: 'rc' | 'rv', lang: ReportLanguage, campusCode?: string): string {
		const campusSuffix = campusCode ? `_${this.sanitizeFilenamePart(campusCode)}` : '';
		return `${this.reportBaseName(type, lang)}${campusSuffix}.pdf`;
	}

	private buildExcelFilename(type: 'rc' | 'rv', lang: 'es' | 'en', campusCode?: string): string {
		const campusSuffix = campusCode ? `_${this.sanitizeFilenamePart(campusCode)}` : '';
		return `${this.reportBaseName(type, lang)}${campusSuffix}_${Date.now()}.xlsx`;
	}

	/** Campus codes are catalog data, not user input, but still get sanitized before landing in a
	 *  filename -- a stray '/' or ':' would otherwise change the path a client saves the file to. */
	private sanitizeFilenamePart(value: string): string {
		return value.replace(/[^\p{L}\p{N}_-]+/gu, '-');
	}

	private buildDocument(
		data: SemaphoreRenderReportDto,
		type: 'rc' | 'rv',
		lang: ReportLanguage,
		campusLabel: string,
	): ReportDocument {
		const L = SEMAPHORE_PDF_LABELS[lang];
		const reportTitle = type === 'rc' ? L.reportTitleRC : L.reportTitleRV;

		return {
			language: lang,
			reportName: reportTitle,
			// RV's title stays just "Reporte de Verificación (RV)" -- the career is already in the
			// metadata block below, so repeating it in the title is redundant. RC keeps it.
			programName: type === 'rv' ? '' : data.metadata.programName,
			metadata: [
				{ label: L.colCampus, value: campusLabel },
				{ label: L.academicPeriod, value: data.metadata.academicPeriodCode },
				{ label: L.modality, value: data.metadata.modalityName },
				{ label: L.career, value: data.metadata.programName },
				{ label: L.accreditor, value: data.metadata.accreditorCode },
				{ label: L.commission, value: data.metadata.commissionName },
				{ label: L.acceptanceLevel, value: L.allLevels },
			],
			bodyHtml:
				type === 'rc'
					? this.buildRcBody(data, reportTitle, lang)
					: this.buildRvBody(data, reportTitle, lang),
			// RV's smaller chart and narrower pivot table (outcome, description, 3 level columns,
			// total) fit a portrait page without breaking mid-table; RC's wider consolidated
			// per-course table still needs landscape.
			orientation: type === 'rc' ? 'landscape' : 'portrait',
			additionalStyles: SEMAPHORE_REPORT_STYLES,
		};
	}

	/**
	 * RC body: chart, the "Interpretación de Indicadores" scale, the critical-outcome summary, and
	 * one consolidated course table.
	 *
	 * The dotted legend line the RV body still carries is deliberately absent -- the scale below
	 * the chart is the same performance-level data rendered as an actual scale, and printing both
	 * would say the same thing twice.
	 */
	private buildRcBody(
		data: SemaphoreRenderReportDto,
		reportTitle: string,
		lang: ReportLanguage,
	): string {
		const L = SEMAPHORE_PDF_LABELS[lang];
		return `
			${this.buildChartSection(data, reportTitle, lang, 'rc')}
			<section>
				<h3>${escapeHtml(L.indicatorScale)}</h3>
				${this.buildIndicatorScale(data.legend)}
			</section>
			${this.buildSummarySection(data, lang)}
			${this.buildConsolidatedSection(data, lang)}
		`;
	}

	/**
	 * RV body: chart (legend hidden -- the level ranges are shown in the "Interpretación de
	 * Indicadores" scale right below it instead) plus the pivoted "Reporte de Verificación
	 * Consolidado" table -- one row per outcome, a count+% cell per level, and a TOTALES row. No
	 * per-course listings: every outcome the courses in scope were evaluated on is already
	 * represented in that single table.
	 */
	private buildRvBody(
		data: SemaphoreRenderReportDto,
		reportTitle: string,
		lang: ReportLanguage,
	): string {
		const L = SEMAPHORE_PDF_LABELS[lang];
		const levelHeaders = data.outcomePivot[0]?.levels ?? [];
		const summaryHeaderCells = levelHeaders
			.map(
				(lv) => `<th style="background-color:${escapeHtml(lv.color)}">${escapeHtml(lv.name)}</th>`,
			)
			.join('');

		const summaryRows = data.outcomePivot
			.map(
				(r) => `
				<tr>
					<td>${escapeHtml(r.outcomeName)}</td>
					<td>${escapeHtml(r.outcomeDescription)}</td>
					${r.levels.map((lv) => `<td>(${lv.count}) ${lv.percentage}%</td>`).join('')}
					<td>${r.totalStudents}</td>
				</tr>`,
			)
			.join('');

		const levelTotals = levelHeaders.map((_, idx) =>
			data.outcomePivot.reduce((sum, r) => sum + r.levels[idx].count, 0),
		);
		const grandTotal = data.outcomePivot.reduce((sum, r) => sum + r.totalStudents, 0);
		const totalsRow =
			data.outcomePivot.length > 0
				? `
				<tr class="totals-row">
					<td colspan="2">${escapeHtml(L.colTotals)}</td>
					${levelTotals.map((t) => `<td>${t}</td>`).join('')}
					<td>${grandTotal}</td>
				</tr>`
				: '';

		return `
			${this.buildChartSection(data, reportTitle, lang, 'rv')}
			<section>
				<h3>${escapeHtml(L.indicatorScale)}</h3>
				${this.buildIndicatorScale(data.legend, true)}
			</section>
			<section>
				<h3>${escapeHtml(L.summary)}</h3>
				<table>
					<thead><tr>
						<th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colDescription)}</th>${summaryHeaderCells}<th>${escapeHtml(L.colTotalStudents)}</th>
					</tr></thead>
					<tbody>${summaryRows}${totalsRow}</tbody>
				</table>
			</section>
		`;
	}

	private buildChartSection(
		data: SemaphoreRenderReportDto,
		reportTitle: string,
		lang: ReportLanguage,
		instrument: 'rc' | 'rv',
	): string {
		if (data.chart.categories.length === 0) return '';
		const L = SEMAPHORE_PDF_LABELS[lang];
		// RV's chart is rendered smaller and without its own legend -- the "Interpretación de
		// Indicadores" scale right below it already carries the level colors/ranges, and its axes
		// get explicit titles since outcome codes were replaced by their short names. RC is left
		// untouched.
		const rvOverrides =
			instrument === 'rv'
				? {
						hideLegend: true as const,
						width: 640,
						plotHeight: 200,
						xAxisLabel: L.axisOutcomes,
					}
				: {};
		return `<section>${this.reportChart.buildGroupedBarChart({
			title: reportTitle,
			categories: data.chart.categories,
			series: data.chart.series,
			yAxisLabel: instrument === 'rv' ? L.axisStudentCount : L.colTotalStudents,
			emptyLabel: L.noTranslation,
			...rvOverrides,
		})}</section>`;
	}

	/** RC-only "Resumen por Outcome" table: critical outcomes only, one row per (campus, outcome,
	 *  level), coloured by that level -- unchanged from before the consolidated-table redesign. */
	private buildSummarySection(data: SemaphoreRenderReportDto, lang: ReportLanguage): string {
		const L = SEMAPHORE_PDF_LABELS[lang];
		const rows = data.outcomeSummary
			.map(
				(r) => `
				<tr style="background-color:${escapeHtml(r.color)}">
					<td>${escapeHtml(r.campus)}</td>
					<td>${escapeHtml(r.outcomeCode)}</td>
					<td>${escapeHtml(r.outcomeName)}</td>
					<td>${r.totalStudents}</td>
					<td>${r.count}</td>
					<td>${r.percentage}%</td>
				</tr>`,
			)
			.join('');
		return `
			<section>
				<h3>${escapeHtml(L.summary)}</h3>
				<table>
					<thead><tr>
						<th>${escapeHtml(L.colCampus)}</th><th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colTotalStudents)}</th><th>${escapeHtml(L.colQuantity)}</th><th>${escapeHtml(L.colPercentage)}</th>
					</tr></thead>
					<tbody>${rows}</tbody>
				</table>
			</section>`;
	}

	/**
	 * The score scale as a single horizontal bar. By default each segment's `flex-grow` is that
	 * level's span, so the bar reads as the real 0-20 scale rather than N equal slices; a level
	 * configured with a non-positive span still gets a visible slice instead of collapsing to
	 * nothing. RV renders it with `equalWidths` instead -- there it's read as a plain legend next
	 * to the outcome table, not as a scale, so every segment gets the same width.
	 */
	private buildIndicatorScale(legend: SemaphoreLevelLegendDto[], equalWidths = false): string {
		if (legend.length === 0) return '';
		const segments = legend
			.map((level, index) => {
				const span = equalWidths
					? 1
					: Math.max(this.levelUpperBound(legend, index) - Number(level.minScore), 1);
				return `
				<div class="indicator-scale__segment" style="flex-grow:${span};background-color:${escapeHtml(level.color)};color:${this.contrastText(level.color)}">
					<span class="indicator-scale__name">${escapeHtml(level.name)}</span>
					<span class="indicator-scale__range">${escapeHtml(this.formatLevelRange(legend, index))}</span>
				</div>`;
			})
			.join('');
		return `<div class="indicator-scale">${segments}</div>`;
	}

	/**
	 * The consolidated course table: `Outcome | Código | Curso | <level…> | Total de Alumnos`, one
	 * block of rows per outcome closed by a TOTALES line. Only the level headers are coloured, in
	 * the level's own colour, so the reader can map a column to a segment of the scale above.
	 */
	private buildConsolidatedSection(data: SemaphoreRenderReportDto, lang: ReportLanguage): string {
		if (data.consolidated.length === 0) return '';
		const L = SEMAPHORE_PDF_LABELS[lang];
		const levelLabels = [L.redDetail, L.yellowDetail, L.greenDetail];
		const levelHeaders = levelLabels
			.map((fallback, index) => {
				const level = data.legend[index];
				const label = level?.name || fallback;
				const style = level
					? ` style="background-color:${escapeHtml(level.color)};color:${this.contrastText(level.color)}"`
					: '';
				return `<th${style}>${escapeHtml(label)}</th>`;
			})
			.join('');

		const cell = (count: number, percentage: number) => `<td>(${count}) ${percentage}%</td>`;
		const body = data.consolidated
			.map(
				(group) => `
				${group.rows
					.map(
						(row) => `
					<tr>
						<td>${escapeHtml(group.outcomeCode)}</td>
						<td>${escapeHtml(row.courseCode)}</td>
						<td>${escapeHtml(row.courseName) || L.noTranslation}</td>
						${row.levels.map((level) => cell(level.count, level.percentage)).join('')}
						<td>${row.totalStudents}</td>
					</tr>`,
					)
					.join('')}
				<tr class="consolidated__totals">
					<td colspan="3">${escapeHtml(L.totals)}</td>
					${group.levelTotals.map((total) => `<td>${total}</td>`).join('')}
					<td>${group.totalStudents}</td>
				</tr>`,
			)
			.join('');

		return `
			<section>
				<h3>${escapeHtml(L.consolidatedDetail)}</h3>
				<table class="consolidated">
					<thead><tr>
						<th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colCode)}</th><th>${escapeHtml(L.colCourse)}</th>${levelHeaders}<th>${escapeHtml(L.colTotalStudents)}</th>
					</tr></thead>
					<tbody>${body}</tbody>
				</table>
			</section>`;
	}

	/**
	 * A level's real upper bound is the next level's `minScore`, not its own `maxScore`: the rows
	 * are stored closed (e.g. `[13, 15.999999]`) to make the SQL's BETWEEN work, so printing
	 * `maxScore` verbatim could render an ugly `15.999999`. The top level has no successor and
	 * keeps its own -- used both for `formatLevelRange` and the RC scale's proportional widths.
	 */
	private levelUpperBound(legend: SemaphoreLevelLegendDto[], index: number): number {
		const next = legend[index + 1];
		return Number(next ? next.minScore : legend[index].maxScore);
	}

	/** Mirror of `levelUpperBound` for the lower edge: a level's real lower bound is the previous
	 *  level's own `maxScore`, not its own (possibly epsilon-shifted) `minScore`. */
	private levelLowerBound(legend: SemaphoreLevelLegendDto[], index: number): number {
		const previous = legend[index - 1];
		return Number(previous ? previous.maxScore : legend[index].minScore);
	}

	/**
	 * Only the two outer levels are half-open, on the side that faces the rest of the scale --
	 * `[0 - 13>` for the lowest, `<16 - 20]` for the highest -- because that shared boundary
	 * belongs to whichever level sits between them. Every level in between (and a lone level with
	 * no neighbors) is closed on both ends, e.g. `[13 - 16]`.
	 */
	private formatLevelRange(legend: SemaphoreLevelLegendDto[], index: number): string {
		const hasNeighbors = legend.length > 1;
		const isFirst = index === 0;
		const isLast = index === legend.length - 1;
		const lowerValue =
			isLast && hasNeighbors ? this.levelLowerBound(legend, index) : Number(legend[index].minScore);
		const upperValue =
			isFirst && hasNeighbors
				? this.levelUpperBound(legend, index)
				: Number(legend[index].maxScore);
		const lower = this.formatScore(lowerValue);
		const upper = this.formatScore(upperValue);
		const openLeft = isLast && hasNeighbors ? '<' : '[';
		const openRight = isFirst && hasNeighbors ? '>' : ']';
		return `${openLeft}${lower} - ${upper}${openRight}`;
	}

	/** Scores are numeric(_, 6) columns, so they arrive as `13.000000`; trim to what a reader reads. */
	private formatScore(value: number): string {
		return String(Math.round(Number(value) * 100) / 100);
	}

	/**
	 * Black or white label text, whichever the segment's own colour can carry. The middle level is
	 * normally yellow, where white text is unreadable, so a fixed colour is not an option.
	 */
	private contrastText(hex: string): string {
		const clean = hex.replace('#', '');
		if (!/^[0-9a-f]{6}$/i.test(clean)) return '#ffffff';
		const [r, g, b] = [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		return luminance > 0.6 ? '#18181b' : '#ffffff';
	}

	private async renderExcel(
		data: SemaphoreRenderReportDto,
		type: 'rc' | 'rv',
		lang: 'es' | 'en',
		campusLabel: string,
	): Promise<Buffer> {
		try {
			return await this.buildExcel(data, type, lang, campusLabel);
		} catch (error) {
			this.logger.error(
				`Semaphore ${type} Excel build failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw new HttpException(
				{
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.excelFailed],
				},
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
	}

	private async buildExcel(
		data: SemaphoreRenderReportDto,
		type: 'rc' | 'rv',
		lang: 'es' | 'en',
		campusLabel: string,
	): Promise<Buffer> {
		const L = SEMAPHORE_PDF_LABELS[lang];
		const wb = new ExcelJS.Workbook();
		wb.creator = 'ABET System';
		wb.created = new Date();

		const summarySheet = wb.addWorksheet(type === 'rc' ? 'RC - Resumen' : 'RV - Resumen');
		const infoRows: [string, string][] = [
			[L.colCampus, campusLabel],
			[L.academicPeriod, data.metadata.academicPeriodCode],
			[L.career, data.metadata.programName],
			[L.accreditor, data.metadata.accreditorCode],
			[L.commission, data.metadata.commissionName],
			[L.acceptanceLevel, L.allLevels],
		];
		for (const [label, value] of infoRows) {
			const row = summarySheet.addRow([label, value]);
			row.getCell(1).font = { bold: true };
		}
		summarySheet.addRow([]);
		const headerRowIndex = summarySheet.rowCount + 1;

		const levelHeaders = data.outcomePivot[0]?.levels ?? [];
		const summaryHeaders = [
			L.colOutcome,
			L.colDescription,
			...levelHeaders.map((lv) => lv.name),
			L.colTotalStudents,
		];
		this.writeExcelHeader(summarySheet, summaryHeaders, headerRowIndex);
		for (const r of data.outcomePivot) {
			const row = summarySheet.addRow([
				r.outcomeName,
				r.outcomeDescription,
				...r.levels.map((lv) => `(${lv.count}) ${lv.percentage}%`),
				r.totalStudents,
			]);
			this.styleExcelRow(row);
		}
		if (data.outcomePivot.length > 0) {
			const totalsRow = summarySheet.addRow([
				L.colTotals,
				'',
				...levelHeaders.map((_, idx) =>
					data.outcomePivot.reduce((sum, r) => sum + r.levels[idx].count, 0),
				),
				data.outcomePivot.reduce((sum, r) => sum + r.totalStudents, 0),
			]);
			totalsRow.font = { bold: true };
		}
		summarySheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];

		const detailHeaders = [
			L.colCampus,
			L.colOutcome,
			L.colOutcome,
			L.colCode,
			L.colCourse,
			L.colQuantity,
			L.colPercentage,
			L.colTotalStudentsByOutcome,
		];
		const takenSheetNames = new Set<string>();
		const addDetailSheet = (name: string, items: SemaphoreCourseDetailRowDto[]) => {
			const sheet = wb.addWorksheet(this.toSheetName(name, takenSheetNames));
			this.writeExcelHeader(sheet, detailHeaders);
			for (const r of items) {
				const row = sheet.addRow([
					r.campus,
					r.outcomeCode,
					r.outcomeName,
					r.courseCode,
					r.courseName || L.noTranslation,
					r.count,
					r.percentage,
					r.totalStudents,
				]);
				this.styleExcelRow(row);
			}
			sheet.views = [{ state: 'frozen', ySplit: 1 }];
		};

		addDetailSheet(L.redDetail, data.redDetail);
		addDetailSheet(L.yellowDetail, data.yellowDetail);
		addDetailSheet(L.greenDetail, data.greenDetail);

		return Buffer.from(await wb.xlsx.writeBuffer());
	}

	/**
	 * Excel rejects the workbook outright on a duplicate or illegal sheet name, and the level labels
	 * are translated free text that can collide once truncated to the 31-character limit.
	 */
	private toSheetName(label: string, taken: Set<string>): string {
		const base = label.replace(/[*?:\\/[\]]/g, ' ').slice(0, 31) || 'Sheet';
		let name = base;
		for (let suffix = 2; taken.has(name); suffix++) {
			name = `${base.slice(0, 31 - String(suffix).length - 1)} ${suffix}`;
		}
		taken.add(name);
		return name;
	}

	private writeExcelHeader(ws: ExcelJS.Worksheet, headers: string[], rowIndex = 1): void {
		ws.columns = headers.map(() => ({ width: 22 }));
		const headerRow = ws.getRow(rowIndex);
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
