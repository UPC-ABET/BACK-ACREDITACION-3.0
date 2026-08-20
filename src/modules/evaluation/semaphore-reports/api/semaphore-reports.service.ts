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
	SemaphoreOutcomeSummaryRowDto,
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
	outcomeSummary: SemaphoreOutcomeSummaryRowDto[];
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
			const data = await this.fetchRenderData(dto, academicPeriodId, instrument, campusIds);
			const { pdf, filename } = await this.reportGenerator.generateDocument(
				this.buildDocument(data, instrument, lang),
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
			document: this.buildDocument(data, instrument, lang),
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
			const data = await this.fetchRenderData(dto, academicPeriodId, instrument, campusIds);
			const xlsx = await this.renderExcel(data, instrument, lang);
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
				pdf: await this.renderExcel(data, instrument, lang),
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

		if (selected.length === allCampuses.length) return { mode: 'all' };
		if (selected.length === 0) this.throwNoData();
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
		const outcomeId = dto.outcomeId ?? null;
		const campusIds = dto.campusIds?.length ? dto.campusIds : null;
		const rubricIds = dto.rubricIds?.length ? dto.rubricIds : null;
		const gradeTypeIds = dto.gradeTypeIds?.length ? dto.gradeTypeIds : null;

		const rows = await this.runQuery(() =>
			instrument === 'rc'
				? this.repository.getRcScreen(
						academicPeriodId,
						programCommissionId,
						outcomeId,
						campusIds,
						lang,
					)
				: this.repository.getRvScreen(
						academicPeriodId,
						programCommissionId,
						outcomeId,
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
		const outcomeId = dto.outcomeId ?? null;
		const rubricIds = dto.rubricIds?.length ? dto.rubricIds : null;
		const gradeTypeIds = dto.gradeTypeIds?.length ? dto.gradeTypeIds : null;

		// Detail, summary and the (unfiltered, chart-feeding) screen breakdown each re-derive the same
		// expensive base CTE, so running them concurrently cuts the wait to the slowest one instead of
		// their sum. Three is also the ceiling this report may take from a pool shared app-wide.
		const [detailRows, summaryRows, screenRows] = await this.runQuery(() =>
			Promise.all(
				instrument === 'rc'
					? ([
							this.repository.getRcDetail(
								academicPeriodId,
								programCommissionId,
								outcomeId,
								campusIds,
								lang,
							),
							this.repository.getRcSummary(
								academicPeriodId,
								programCommissionId,
								outcomeId,
								campusIds,
								lang,
							),
							this.repository.getRcScreen(
								academicPeriodId,
								programCommissionId,
								outcomeId,
								campusIds,
								lang,
							),
						] as const)
					: ([
							this.repository.getRvDetail(
								academicPeriodId,
								programCommissionId,
								outcomeId,
								campusIds,
								lang,
								rubricIds,
								gradeTypeIds,
							),
							this.repository.getRvSummary(
								academicPeriodId,
								programCommissionId,
								outcomeId,
								campusIds,
								lang,
								rubricIds,
								gradeTypeIds,
							),
							this.repository.getRvScreen(
								academicPeriodId,
								programCommissionId,
								outcomeId,
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

	/** Aggregates red/yellow/green student counts per outcome for the PDF chart. */
	private buildOutcomeChartData(
		screenRows: SemaphoreCourseOutcomeRow[],
		legend: SemaphoreLevelLegendDto[],
		lang: ReportLanguage,
	): SemaphoreChartData {
		const L = SEMAPHORE_PDF_LABELS[lang];
		const byOutcome = new Map<string, { red: number; yellow: number; green: number }>();
		for (const r of screenRows) {
			const entry = byOutcome.get(r.outcomeCode) ?? { red: 0, yellow: 0, green: 0 };
			entry.red += Number(r.studentsRed);
			entry.yellow += Number(r.studentsYellow);
			entry.green += Number(r.studentsGreen);
			byOutcome.set(r.outcomeCode, entry);
		}
		const categories = [...byOutcome.keys()].sort((a, b) =>
			a.localeCompare(b, undefined, { numeric: true }),
		);
		const entries = categories.map((code) => byOutcome.get(code)!);
		const color = (rank: number, fallback: string): string => legend[rank]?.color ?? fallback;
		const name = (rank: number, fallback: string): string => legend[rank]?.name ?? fallback;
		return {
			categories,
			series: [
				{
					label: name(0, L.redDetail),
					color: color(0, '#e30613'),
					values: entries.map((e) => e.red),
				},
				{
					label: name(1, L.yellowDetail),
					color: color(1, '#f4c20d'),
					values: entries.map((e) => e.yellow),
				},
				{
					label: name(2, L.greenDetail),
					color: color(2, '#16a34a'),
					values: entries.map((e) => e.green),
				},
			],
		};
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

	private buildRenderReport(
		detailRows: SemaphoreDetailRow[],
		summaryRows: SemaphoreSummaryRow[],
		screenRows: SemaphoreCourseOutcomeRow[],
		legendRows: SemaphoreLevelLegendRow[],
		metadata: MetadataRow | null,
		lang: ReportLanguage = 'es',
	): SemaphoreRenderReportDto {
		const legend = this.buildLegend(legendRows);
		const levelName = (rank: number): string => legend[rank - 1]?.name ?? '';
		const levelColor = (rank: number): string => legend[rank - 1]?.color ?? '#6b7280';

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
			chart: this.buildOutcomeChartData(screenRows, legend, lang),
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
					<td>${escapeHtml(r.campus)}</td>
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

		const bodyHtml = `
			<section>
				<h3>${escapeHtml(L.legendTitle)}</h3>
				<div class="legend-line">${legendLine}</div>
			</section>
			${chartHtml}
			<section>
				<h3>${escapeHtml(L.summary)}</h3>
				<table>
					<thead><tr>
						<th>${escapeHtml(L.colCampus)}</th><th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colOutcome)}</th><th>${escapeHtml(L.colTotalStudents)}</th><th>${escapeHtml(L.colQuantity)}</th><th>${escapeHtml(L.colPercentage)}</th>
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

	private async renderExcel(
		data: SemaphoreRenderReportDto,
		type: 'rc' | 'rv',
		lang: 'es' | 'en',
	): Promise<Buffer> {
		try {
			return await this.buildExcel(data, type, lang);
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
	): Promise<Buffer> {
		const L = SEMAPHORE_PDF_LABELS[lang];
		const wb = new ExcelJS.Workbook();
		wb.creator = 'ABET System';
		wb.created = new Date();

		const summarySheet = wb.addWorksheet(type === 'rc' ? 'RC - Resumen' : 'RV - Resumen');
		const summaryHeaders = [
			L.colCampus,
			L.colOutcome,
			L.colOutcome,
			L.colTotalStudents,
			L.colQuantity,
			L.colPercentage,
		];
		this.writeExcelHeader(summarySheet, summaryHeaders);
		for (const r of data.outcomeSummary) {
			const row = summarySheet.addRow([
				r.campus,
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
