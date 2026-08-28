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
	SemaphoreLevelLegendDto,
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
	redDetail: SemaphoreCourseDetailRowDto[];
	yellowDetail: SemaphoreCourseDetailRowDto[];
	greenDetail: SemaphoreCourseDetailRowDto[];
	metadata: SemaphoreReportDto['metadata'];
}

/** What the download endpoints hand the controller -- content type varies with the campus plan. */
interface SemaphoreDownload {
	buffer: Buffer;
	filename: string;
	contentType: string;
}

/**
 * How a campus selection resolves for a download (see docs/CONTEXT.md's report business rules):
 *  - 'all': no campus filter, or the selection covers every active campus -- one consolidated
 *    report with every campus's data.
 *  - 'single': exactly one campus selected -- one report scoped to it.
 *  - 'zip': more than one campus selected, short of all of them -- one report per selected
 *    campus, bundled into a zip.
 */
type SemaphoreCampusPlan =
	| { mode: 'all' }
	| { mode: 'single' | 'zip'; campuses: SemaphoreCampusRow[] };

/** Buckets rows carrying a `campusId` by that id -- used to split one shared, multi-campus query
 *  result into each campus's own slice without a separate query per campus. */
function groupByCampusId<T extends { campusId: number }>(rows: T[]): Map<number, T[]> {
	const grouped = new Map<number, T[]>();
	for (const row of rows) {
		const bucket = grouped.get(row.campusId);
		if (bucket) bucket.push(row);
		else grouped.set(row.campusId, [row]);
	}
	return grouped;
}

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
	 * Campus-selection-aware PDF download: one consolidated report, one report scoped to a single
	 * campus, or a zip of one report per campus -- see `SemaphoreCampusPlan`.
	 */
	private async generatePdfDownload(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
		instrument: 'rc' | 'rv',
	): Promise<SemaphoreDownload> {
		const lang = (dto.lang ?? 'es') as ReportLanguage;
		const plan = await this.resolveCampusPlan(dto.campusIds, lang);

		if (plan.mode !== 'zip') {
			const campusIds = plan.mode === 'single' ? [plan.campuses[0].id] : null;
			const campusCode = plan.mode === 'single' ? plan.campuses[0].code : undefined;
			const campusLabel =
				plan.mode === 'single' ? plan.campuses[0].name : SEMAPHORE_PDF_LABELS[lang].allCampuses;
			const data = await this.fetchRenderData(dto, academicPeriodId, instrument, campusIds);
			const { pdf, filename } = await this.reportGenerator.generateDocument(
				this.buildDocument(data, instrument, lang, campusLabel),
				this.buildFilename(instrument, lang, campusCode),
			);
			return { buffer: pdf, filename, contentType: 'application/pdf' };
		}

		const perCampus = await this.fetchPerCampusRenderData(
			dto,
			academicPeriodId,
			instrument,
			plan.campuses,
		);
		const reports = perCampus.map(({ campus, data }) => ({
			document: this.buildDocument(data, instrument, lang, campus.name),
			filename: this.buildFilename(instrument, lang, campus.code),
		}));
		const { zip, filename } = await this.reportGenerator.generateZip(
			reports,
			this.buildZipFilename(instrument, lang),
		);
		return { buffer: zip, filename, contentType: 'application/zip' };
	}

	/** Same campus-selection rules as `generatePdfDownload`, but rendering XLSX workbooks. */
	private async generateExcelDownload(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
		instrument: 'rc' | 'rv',
	): Promise<SemaphoreDownload> {
		const lang = (dto.lang ?? 'es') as 'es' | 'en';
		const plan = await this.resolveCampusPlan(dto.campusIds, lang);

		if (plan.mode !== 'zip') {
			const campusIds = plan.mode === 'single' ? [plan.campuses[0].id] : null;
			const campusCode = plan.mode === 'single' ? plan.campuses[0].code : undefined;
			const campusLabel =
				plan.mode === 'single' ? plan.campuses[0].name : SEMAPHORE_PDF_LABELS[lang].allCampuses;
			const data = await this.fetchRenderData(dto, academicPeriodId, instrument, campusIds);
			const xlsx = await this.renderExcel(data, instrument, lang, campusLabel);
			return {
				buffer: xlsx,
				filename: this.buildExcelFilename(instrument, lang, campusCode),
				contentType: XLSX_CONTENT_TYPE,
			};
		}

		const perCampus = await this.fetchPerCampusRenderData(
			dto,
			academicPeriodId,
			instrument,
			plan.campuses,
		);
		// Workbook building is CPU-bound (ExcelJS, no DB round trip), so building every campus's
		// file concurrently is safe and keeps the zip from serializing on the slowest one.
		const files = await Promise.all(
			perCampus.map(async ({ campus, data }) => ({
				filename: this.buildExcelFilename(instrument, lang, campus.code),
				pdf: await this.renderExcel(data, instrument, lang, campus.name),
			})),
		);

		const { zip, filename } = await this.reportGenerator.archivePdfFiles(
			files,
			this.buildZipFilename(instrument, lang),
		);
		return { buffer: zip, filename, contentType: 'application/zip' };
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
	 * selection, or one that names every active campus, is treated as "all" -- the caller must not
	 * trust the client's own idea of "select all" (e.g. a stale campus list on the frontend), since
	 * that would silently start zipping a selection that was actually meant to be consolidated.
	 */
	private async resolveCampusPlan(
		campusIds: number[] | undefined,
		lang: string,
	): Promise<SemaphoreCampusPlan> {
		const requested = campusIds?.length ? [...new Set(campusIds)] : null;
		if (!requested) return { mode: 'all' };

		const allCampuses = await this.runQuery(() => this.repository.getCampuses(lang));
		const requestedSet = new Set(requested);
		const selected = allCampuses.filter((campus) => requestedSet.has(campus.id));

		if (selected.length === 0) this.throwNoData();
		if (selected.length === allCampuses.length) return { mode: 'all' };
		return { mode: selected.length === 1 ? 'single' : 'zip', campuses: selected };
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
	 * resolved by the caller (`resolveCampusPlan`), not read off `dto`: the single/consolidated case
	 * passes `null` (or a single id); the zip case never calls this per campus -- see
	 * `fetchPerCampusRenderData`, which fetches every selected campus in one pass instead.
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
		);
	}

	/**
	 * The three heavy report queries (detail/summary/screen), run once. Kept apart from
	 * `buildRenderReport` so the zip path can call this ONCE for every selected campus together
	 * (`campusIds` holding all of them) and split the result per campus in memory afterwards,
	 * instead of re-running this same multi-way join once per campus -- see
	 * `fetchPerCampusRenderData`.
	 */
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
	 *  scoped respectively), so every caller -- single report or the whole zip -- fetches them once. */
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

	/**
	 * The zip path's data fetch: every selected campus's detail/summary/screen rows in ONE call to
	 * `fetchRenderRows` (campus-scoped only by the full selection, not one call per campus), then
	 * split by each row's own `campusId` to build one `SemaphoreRenderReportDto` per campus.
	 *
	 * This is safe because the detail/summary SQL's window functions partition by
	 * `(campus, outcome_code)` already -- see semaphore-reports.sql.ts -- so a campus's computed
	 * quantities/percentages/critical-selection do not depend on which OTHER campuses' rows are
	 * present in the same query result. Fetching campus A and campus B together and then grouping by
	 * `campusId` in memory yields byte-identical numbers to fetching them one at a time; it only
	 * changes how many times the underlying multi-way join runs.
	 *
	 * A campus with no rows in the shared fetch is skipped rather than failing the whole zip
	 * (`throwNoData` only fires if not a single selected campus has data).
	 */
	private async fetchPerCampusRenderData(
		dto: SemaphoreFilterDto,
		academicPeriodId: number,
		instrument: 'rc' | 'rv',
		campuses: SemaphoreCampusRow[],
	): Promise<Array<{ campus: SemaphoreCampusRow; data: SemaphoreRenderReportDto }>> {
		const lang = (dto.lang ?? 'es') as ReportLanguage;
		const [{ detailRows, summaryRows, screenRows }, [legendRows, metadata]] = await Promise.all([
			this.fetchRenderRows(
				dto,
				academicPeriodId,
				instrument,
				campuses.map((campus) => campus.id),
			),
			this.fetchLegendAndMetadata(dto, academicPeriodId, instrument),
		]);

		const detailByCampus = groupByCampusId(detailRows);
		const summaryByCampus = groupByCampusId(summaryRows);
		const screenByCampus = groupByCampusId(screenRows);

		const reports: Array<{ campus: SemaphoreCampusRow; data: SemaphoreRenderReportDto }> = [];
		for (const campus of campuses) {
			const campusDetailRows = detailByCampus.get(campus.id) ?? [];
			if (campusDetailRows.length === 0) continue;
			reports.push({
				campus,
				data: this.buildRenderReport(
					campusDetailRows,
					summaryByCampus.get(campus.id) ?? [],
					screenByCampus.get(campus.id) ?? [],
					legendRows,
					metadata,
					lang,
				),
			});
		}
		if (reports.length === 0) this.throwNoData();
		return reports;
	}

	/** Sums red/yellow/green student counts per outcome across every course and campus in the
	 *  (unfiltered) screen rows -- shared by the PDF chart and the pivoted summary table. */
	private aggregateOutcomeCounts(
		screenRows: SemaphoreCourseOutcomeRow[],
	): { code: string; name: string; red: number; yellow: number; green: number; total: number }[] {
		const byOutcome = new Map<
			string,
			{ name: string; red: number; yellow: number; green: number; total: number }
		>();
		for (const r of screenRows) {
			const entry = byOutcome.get(r.outcomeCode) ?? {
				name: r.outcomeDescription || r.outcomeName,
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
		const codes = [...byOutcome.keys()].sort((a, b) =>
			a.localeCompare(b, undefined, { numeric: true }),
		);
		return codes.map((code) => ({ code, ...byOutcome.get(code)! }));
	}

	/** Aggregates red/yellow/green student counts per outcome for the PDF chart. */
	private buildOutcomeChartData(
		screenRows: SemaphoreCourseOutcomeRow[],
		legend: SemaphoreLevelLegendDto[],
		lang: ReportLanguage,
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
			categories: entries.map((e) => e.code),
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

	/** One row per outcome, with a count+percentage cell per acceptance level -- the "Reporte de
	 *  Verificación Consolidado" table shape (Outcome | Descripción | level columns | Total). */
	private buildOutcomePivot(
		screenRows: SemaphoreCourseOutcomeRow[],
		legend: SemaphoreLevelLegendDto[],
	): SemaphoreOutcomePivotRowDto[] {
		const entries = this.aggregateOutcomeCounts(screenRows);
		const pct = (count: number, total: number): number =>
			total > 0 ? Math.round((count / total) * 10000) / 100 : 0;
		const level = (rank: number, count: number, total: number, fallback: string) => ({
			name: legend[rank]?.name ?? fallback,
			color: legend[rank]?.color ?? '#6b7280',
			count,
			percentage: pct(count, total),
		});
		return entries.map((e) => ({
			outcomeCode: e.code,
			outcomeName: e.name,
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
				commissionName: metadata?.commissionName ?? '',
				academicPeriodCode: metadata?.academicPeriodCode ?? '',
				accreditorCode: metadata?.accreditorCode ?? '',
			},
		};
	}

	/** `summaryRows` (the critical/representative rows) is fetched by `fetchRenderRows` for the
	 *  per-campus zip split, but the render report's summary table is now the full outcome pivot
	 *  built from `screenRows` -- see `buildOutcomePivot`. */
	private buildRenderReport(
		detailRows: SemaphoreDetailRow[],
		_summaryRows: SemaphoreSummaryRow[],
		screenRows: SemaphoreCourseOutcomeRow[],
		legendRows: SemaphoreLevelLegendRow[],
		metadata: MetadataRow | null,
		lang: ReportLanguage = 'es',
	): SemaphoreRenderReportDto {
		const legend = this.buildLegend(legendRows);

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
			chart: this.buildOutcomeChartData(screenRows, legend, lang),
			outcomePivot: this.buildOutcomePivot(screenRows, legend),
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

	/** Zip filename for the multi-campus download -- no campus suffix, since it holds all of them. */
	private buildZipFilename(type: 'rc' | 'rv', lang: 'es' | 'en'): string {
		return `${this.reportBaseName(type, lang)}.zip`;
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
					<td>${escapeHtml(r.outcomeCode)}</td>
					<td>${escapeHtml(r.outcomeName)}</td>
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

		const detailBlock = (label: string, items: SemaphoreCourseDetailRowDto[]) => {
			if (items.length === 0) return '';
			const rows = items
				.map(
					(r) => `
					<tr>
						<td>${escapeHtml(r.campus)}</td>
						<td>${escapeHtml(r.outcomeCode)}</td>
						<td>${escapeHtml(r.outcomeName)}</td>
						<td>${escapeHtml(r.courseCode)}</td>
						<td>${escapeHtml(r.courseName) || L.noTranslation}</td>
						<td>${r.count}</td>
						<td>${r.percentage}%</td>
						<td>${r.totalStudents}</td>
					</tr>`,
				)
				.join('');
			return `
				<section>
					<h4>${escapeHtml(label)} (${items.length})</h4>
					<table>
						<thead><tr>
							<th>${escapeHtml(L.colCampus)}</th><th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colCode)}</th><th>${escapeHtml(L.colCourse)}</th><th>${escapeHtml(L.colQuantity)}</th><th>${escapeHtml(L.colPercentage)}</th><th>${escapeHtml(L.colTotalStudentsByOutcome)}</th>
						</tr></thead>
						<tbody>${rows}</tbody>
					</table>
				</section>`;
		};

		const chartHtml =
			data.chart.categories.length > 0
				? `<section>${this.reportChart.buildGroupedBarChart({
						title: reportTitle,
						categories: data.chart.categories,
						series: data.chart.series,
						yAxisLabel: L.colTotalStudents,
						emptyLabel: L.noTranslation,
					})}</section>`
				: '';

		// The RV "Reporte de Verificación Consolidado" is legend + chart + the pivoted outcome
		// table only -- no per-course listings. RC keeps its course-level detail blocks.
		const detailSections =
			type === 'rc'
				? `
			${detailBlock(L.redDetail, data.redDetail)}
			${detailBlock(L.yellowDetail, data.yellowDetail)}
			${detailBlock(L.greenDetail, data.greenDetail)}`
				: '';

		const bodyHtml = `
			${chartHtml}
			<section>
				<h3>${escapeHtml(L.summary)}</h3>
				<table>
					<thead><tr>
						<th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colDescription)}</th>${summaryHeaderCells}<th>${escapeHtml(L.colTotalStudents)}</th>
					</tr></thead>
					<tbody>${summaryRows}${totalsRow}</tbody>
				</table>
			</section>${detailSections}
		`;

		return {
			language: lang,
			reportName: reportTitle,
			programName: data.metadata.programName,
			metadata: [
				{ label: L.colCampus, value: campusLabel },
				{ label: L.academicPeriod, value: data.metadata.academicPeriodCode },
				{ label: L.career, value: data.metadata.programName },
				{ label: L.accreditor, value: data.metadata.accreditorCode },
				{ label: L.commission, value: data.metadata.commissionName },
				{ label: L.acceptanceLevel, value: L.allLevels },
			],
			bodyHtml,
			orientation: 'landscape',
			additionalStyles: SEMAPHORE_REPORT_STYLES,
		};
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
				r.outcomeCode,
				r.outcomeName,
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

	private hexToArgb(hex: string): string {
		const clean = hex.replace('#', '');
		return `FF${clean.length === 6 ? clean.toUpperCase() : 'FFFFFF'}`;
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
