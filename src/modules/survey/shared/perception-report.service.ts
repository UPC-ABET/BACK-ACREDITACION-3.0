import { Injectable } from '@nestjs/common';
import { ReportChartService } from 'src/libs/reporting/report-chart.service';
import { ReportGeneratorService } from 'src/libs/reporting/report-generator.service';
import { createConcurrencyLimiter } from 'src/libs/reporting/concurrency-limit';
import type {
	ReportDocument,
	ReportLanguage,
	ReportMetadataItem,
} from 'src/libs/reporting/report.types';
import { escapeHtml, localize, sanitizeReportFilename } from 'src/libs/reporting/report.utils';
import type { I18nText } from 'src/shared/types/i18n';
import { BadRequestError } from 'src/commons/domain-error';
import { perceptionReportValidationStrings } from './config/strings/perception-report.validation';
import {
	PerceptionReportRepository,
	type ConfiguredOutcomeRow,
	type OutcomeOption,
	type PerceptionScoreRow,
} from './core/perception-report.repository';

/**
 * Splits the report into one PDF per survey number (PPP's first vs second internship),
 * naming each one in the header and the filename.
 */
export interface PerceptionSurveyNumberSplit {
	label: I18nText;
	valueLabels: Record<number, I18nText>;
}

export interface PerceptionReportRequest {
	surveyTypeCode: string;
	fileLabel: string;
	reportName: I18nText;
	totalLabel: I18nText;
	academicPeriodId: number;
	programId?: number;
	commissionId?: number;
	campusId?: number;
	surveyNumbers?: number[];
	surveyNumberSplit?: PerceptionSurveyNumberSplit;
	modalityLabel?: string;
	courseId?: number;
	courseSectionId?: number;
	/** Overrides LABELS.chartTitle for this report type only (e.g. LCFC's "Percepción por Curso"). */
	chartTitle?: I18nText;
	/** LCFC-only: always show CURSO/NRC in the header (as "TODOS" when unfiltered) instead of
	 *  omitting them — GRA/PPP have no course/NRC concept and leave this unset. */
	showCourseFilters?: boolean;
	lang: ReportLanguage;
}

export interface GeneratedReportFile {
	campusId: number | null;
	campusName: string;
	filename: string;
	base64: string;
}

export interface PerceptionReportResult {
	reports: GeneratedReportFile[];
	zip: { filename: string; base64: string } | null;
}

interface ReportSection {
	campusId: number | null;
	label: string;
	rows: PerceptionScoreRow[];
	configuredOutcomes: ConfiguredOutcomeRow[];
}

interface SurveyNumberGroup {
	label: string | null;
	rows: PerceptionScoreRow[];
}

/** Resolved course/NRC/professor display strings for the report header (curso/NRC filters). */
interface CourseHeaderInfo {
	courseLabel: string;
	sectionCode?: string;
	professorName?: string;
	/** True for one real course/section (explicit filter, or one auto-split file) — false for the
	 *  "TODOS los cursos" combined aggregate, which still spans every outcome. */
	isSpecific: boolean;
}

interface CourseGroup {
	courseHeader: CourseHeaderInfo | undefined;
	rows: PerceptionScoreRow[];
}

interface OutcomeAggregate {
	code: string;
	label: string;
	name: string;
	counts: number[];
	total: number;
	scoreSum: number;
}

interface AcceptanceBand {
	name: string;
	minScore: number;
	maxScore: number;
	color: string;
}

const BAND_COLORS = ['#e30613', '#f4c20d', '#16a34a', '#2563eb', '#7c3aed'];

const REPORT_STYLES = `
	section { break-inside: avoid; margin-top: 18px; }
	section h3 { color: #18181b; font-size: 12pt; margin: 0 0 10px; }
	thead th { background: #3a3a3c; color: #fff; text-align: center; }
	td.num, th.num { text-align: center; }
	.band-cell { color: #fff; font-weight: 700; }
	.course-outcome-table { font-size: 8.5pt; }
	.course-outcome-table th, .course-outcome-table td { padding: 4px 6px; }
`;

const LABELS = {
	es: {
		outcome: 'Outcome',
		average: 'Promedio',
		modality: 'Modalidad de Estudio',
		count: 'Cantidad',
		chartTitle: 'Percepción por Outcome',
		acceptanceTitle: 'Niveles de aceptación',
		acceptanceLevel: 'Nivel de Aceptación',
		values: 'Valores',
		resultsTitle: 'Resultados por Outcome',
		period: 'Periodo',
		campus: 'Sede',
		commission: 'Comisión',
		course: 'Curso',
		courseCode: 'Código',
		responses: 'Respuestas',
		nrc: 'NRC',
		professor: 'Docente',
		allCampuses: 'TODAS',
		allCommissions: 'TODAS',
		allPrograms: 'TODAS LAS CARRERAS',
		all: 'TODOS',
		empty: 'Sin datos para los filtros seleccionados',
	},
	en: {
		outcome: 'Outcome',
		average: 'Average',
		modality: 'Study modality',
		count: 'Count',
		chartTitle: 'Perception by outcome',
		acceptanceTitle: 'Acceptance levels',
		acceptanceLevel: 'Acceptance level',
		values: 'Values',
		resultsTitle: 'Results by outcome',
		period: 'Period',
		campus: 'Campus',
		commission: 'Commission',
		course: 'Course',
		courseCode: 'Code',
		responses: 'Responses',
		nrc: 'NRC',
		professor: 'Professor',
		allCampuses: 'ALL',
		allCommissions: 'ALL',
		allPrograms: 'ALL CAREERS',
		all: 'ALL',
		empty: 'No data for the selected filters',
	},
} as const;

@Injectable()
export class PerceptionReportService {
	constructor(
		private readonly repository: PerceptionReportRepository,
		private readonly reportChart: ReportChartService,
		private readonly reportGenerator: ReportGeneratorService,
	) {}

	async generate(request: PerceptionReportRequest): Promise<PerceptionReportResult> {
		const surveyTypeId = await this.repository.getSurveyTypeId(request.surveyTypeCode);
		if (!surveyTypeId) return { reports: [], zip: null };

		const [
			rows,
			bands,
			programName,
			periodCode,
			commissionName,
			configuredOutcomes,
			courseSectionLabel,
		] = await Promise.all([
			this.repository.getScoreRows({
				surveyTypeId,
				academicPeriodId: request.academicPeriodId,
				programId: request.programId,
				commissionId: request.commissionId,
				campusId: request.campusId,
				surveyNumbers: request.surveyNumbers,
				courseId: request.courseId,
				courseSectionId: request.courseSectionId,
			}),
			this.loadBands(surveyTypeId, request.academicPeriodId, request.lang),
			request.programId ? this.repository.getProgramName(request.programId) : Promise.resolve(null),
			this.repository.getPeriodCode(request.academicPeriodId),
			request.commissionId
				? this.repository.getCommissionName(request.commissionId)
				: Promise.resolve(null),
			// Seeds the report with every outcome configured via the mass outcomes upload (Carrera
			// x Comisión), so commissions/outcomes without a single response yet (e.g. a newly
			// configured CAC/ICT) still appear with a zero count instead of being silently omitted.
			this.repository.getConfiguredOutcomes(
				request.academicPeriodId,
				request.programId,
				request.commissionId,
			),
			request.courseId || request.courseSectionId
				? this.repository.getCourseSectionLabel({
						courseId: request.courseId,
						courseSectionId: request.courseSectionId,
					})
				: Promise.resolve(null),
		]);

		if (rows.length === 0 && configuredOutcomes.length === 0) return { reports: [], zip: null };

		const L = LABELS[request.lang];
		const localizedProgram = programName
			? this.localizeValue(programName, request.lang)
			: L.allPrograms;

		const headerCommission = commissionName
			? this.localizeValue(commissionName, request.lang)
			: L.allCommissions;

		const courseHeader: CourseHeaderInfo | undefined = courseSectionLabel
			? {
					courseLabel: this.localizeValue(courseSectionLabel.courseName, request.lang),
					sectionCode: courseSectionLabel.sectionCode ?? undefined,
					professorName: courseSectionLabel.professorName ?? undefined,
					isSpecific: true,
				}
			: request.showCourseFilters
				? { courseLabel: L.all, isSpecific: false }
				: undefined;

		// No curso/NRC picked → same treatment as sede with no campus picked: one PDF per course
		// (NRC/docente collapsed to "TODOS" — i.e. aggregated across all its sections) plus one
		// combined "TODOS los cursos" PDF. A courseId/courseSectionId filter already narrowed `rows`
		// to a single course, so there's nothing left to split. LCFC-only (showCourseFilters) — GRA
		// and PPP surveys carry a course_section_id too, but curso/NRC isn't a filter concept for
		// them, so they must never auto-split by course.
		const useCourseSplit =
			Boolean(request.showCourseFilters) &&
			request.courseId === undefined &&
			request.courseSectionId === undefined;

		const documents = this.buildSurveyNumberGroups(rows, request).flatMap((group) => {
			const courseGroups: CourseGroup[] = useCourseSplit
				? this.buildCourseGroups(group.rows, request.lang, Boolean(request.showCourseFilters), L)
				: [{ courseHeader, rows: group.rows }];

			return courseGroups.flatMap((courseGroup) =>
				this.buildGroupDocuments({
					group: { label: group.label, rows: courseGroup.rows },
					bands,
					request,
					configuredOutcomes,
					programLabel: localizedProgram,
					periodCode: periodCode ?? String(request.academicPeriodId),
					headerCommission,
					courseHeader: courseGroup.courseHeader,
					labels: L,
				}),
			);
		});

		// The course/campus/commission split can fan out into dozens of PDFs for one request
		// (course × campus cross product). Firing them all at once floods the shared PDF-render
		// gate's queue (PdfRendererService, limit 2 + 20 queued) and other callers get rejected as
		// "busy" — so this request's own renders are locally throttled too.
		const renderLimit = await createConcurrencyLimiter(3);

		const generated = await Promise.all(
			documents.map((entry) =>
				renderLimit(async () => {
					const { pdf } = await this.reportGenerator.generateDocument(
						entry.document,
						entry.filename,
					);
					return {
						campusId: entry.campusId,
						campusName: entry.campusName,
						filename: entry.filename,
						base64: pdf.toString('base64'),
						pdf,
					};
				}),
			),
		);

		const reports: GeneratedReportFile[] = generated.map((file) => ({
			campusId: file.campusId,
			campusName: file.campusName,
			filename: file.filename,
			base64: file.base64,
		}));

		let zip: PerceptionReportResult['zip'] = null;
		if (generated.length > 1) {
			const archive = await this.reportGenerator.archivePdfFiles(
				generated.map((g) => ({ filename: g.filename, pdf: g.pdf })),
				this.buildZipFilename(request.fileLabel),
			);
			zip = { filename: archive.filename, base64: archive.zip.toString('base64') };
		}

		return { reports, zip };
	}

	async listOutcomes(
		programId: number,
		commissionId: number,
		academicPeriodId: number,
	): Promise<OutcomeOption[]> {
		return this.repository.getOutcomesForCommission(programId, commissionId, academicPeriodId);
	}

	/**
	 * "Percepción por Outcome": same score data as `generate()`, scoped to a single outcome, but
	 * grouped by course instead of by outcome — one mini chart per course plus one shared results
	 * table, all in a single PDF. There's no campus/course split here; narrowing to one outcome is
	 * the whole point, so there's nothing left to split by.
	 */
	/**
	 * No outcome picked → one PDF per outcome configured for the program/commission (mirroring how
	 * `generate()` splits "Percepción por Curso" per course when no curso is picked), zipped
	 * together when there's more than one.
	 */
	async generateOutcomeReport(request: {
		surveyTypeCode: string;
		fileLabel: string;
		academicPeriodId: number;
		programId: number;
		commissionId: number;
		outcomeId?: number;
		lang: ReportLanguage;
	}): Promise<PerceptionReportResult> {
		const outcomeIds = request.outcomeId
			? [request.outcomeId]
			: (
					await this.repository.getOutcomesForCommission(
						request.programId,
						request.commissionId,
						request.academicPeriodId,
					)
				).map((outcome) => outcome.id);

		if (outcomeIds.length === 0) return { reports: [], zip: null };

		// Same reasoning as generate(): don't fire every PDF render at once and flood the shared
		// render gate.
		const renderLimit = await createConcurrencyLimiter(3);

		const generated = (
			await Promise.all(
				outcomeIds.map((outcomeId) =>
					renderLimit(() => this.generateSingleOutcomeReport({ ...request, outcomeId })),
				),
			)
		).filter((entry): entry is { filename: string; base64: string; pdf: Buffer } => entry !== null);

		if (generated.length === 0) return { reports: [], zip: null };

		const reports: GeneratedReportFile[] = generated.map((file) => ({
			campusId: null,
			campusName: '',
			filename: file.filename,
			base64: file.base64,
		}));

		let zip: PerceptionReportResult['zip'] = null;
		if (generated.length > 1) {
			const archive = await this.reportGenerator.archivePdfFiles(
				generated.map((g) => ({ filename: g.filename, pdf: g.pdf })),
				`${sanitizeReportFilename(`Reportes_${request.fileLabel}_Percepcion_Por_Outcome_${dateStamp()}`)}.zip`,
			);
			zip = { filename: archive.filename, base64: archive.zip.toString('base64') };
		}

		return { reports, zip };
	}

	private async generateSingleOutcomeReport(request: {
		surveyTypeCode: string;
		fileLabel: string;
		academicPeriodId: number;
		programId: number;
		commissionId: number;
		outcomeId: number;
		lang: ReportLanguage;
	}): Promise<{ filename: string; base64: string; pdf: Buffer } | null> {
		const surveyTypeId = await this.repository.getSurveyTypeId(request.surveyTypeCode);
		if (!surveyTypeId) return null;

		const L = LABELS[request.lang];

		const [rows, bands, programName, commissionName, periodCode, outcome] = await Promise.all([
			this.repository.getScoreRows({
				surveyTypeId,
				academicPeriodId: request.academicPeriodId,
				programId: request.programId,
				commissionId: request.commissionId,
				outcomeId: request.outcomeId,
			}),
			this.loadBands(surveyTypeId, request.academicPeriodId, request.lang),
			this.repository.getProgramName(request.programId),
			this.repository.getCommissionName(request.commissionId),
			this.repository.getPeriodCode(request.academicPeriodId),
			this.repository.getOutcomeById(request.outcomeId),
		]);

		if (rows.length === 0) return null;

		// Group the outcome-scoped score rows by course — the courses "belonging" to this outcome
		// are simply whichever ones have recorded responses for it. The axis/table label is the
		// course CODE (not the name), matching how the outcome axis shows codes elsewhere.
		const byCourse = new Map<number, OutcomeAggregate>();
		for (const row of rows) {
			if (row.courseId === null || row.courseId === undefined) continue;
			let entry = byCourse.get(row.courseId);
			if (!entry) {
				const courseCode = row.courseCode || String(row.courseId);
				const courseName = this.localizeValue(row.courseName, request.lang) || courseCode;
				entry = {
					code: courseCode,
					label: courseCode,
					name: courseName,
					counts: bands.map(() => 0),
					total: 0,
					scoreSum: 0,
				};
				byCourse.set(row.courseId, entry);
			}
			const score = Number(row.score);
			const bandIndex = this.bandIndexForScore(score, bands);
			entry.counts[bandIndex] += row.count;
			entry.total += row.count;
			entry.scoreSum += score * row.count;
		}

		const courses = [...byCourse.values()].sort((a, b) =>
			a.label.localeCompare(b.label, undefined, { numeric: true }),
		);
		if (courses.length === 0) return null;

		const totalLabel = this.localizeValue(
			{ es: 'Total de estudiantes', en: 'Total students' },
			request.lang,
		);
		// Short form only ("1", not "EAC-SI-1 - 1") — matches how the outcome axis is labelled
		// everywhere else in this report family.
		const outcomeShort = outcome ? outcomeLabel(outcome.code) : String(request.outcomeId);
		const outcomeFullLabel = outcome
			? `${outcome.code} - ${this.localizeValue(outcome.name, request.lang)}`
			: String(request.outcomeId);

		// Reuses buildChart as-is by shaping each course like an OutcomeAggregate (one chart, all
		// courses as categories, bands as the grouped bars); the results table is its own builder
		// since it needs both the course name and its code, not just one label. The chart heading
		// is the report's own name (like "Percepción por Curso"'s fixed title) — the specific
		// outcome is already in the header metadata, so repeating it as the title is redundant.
		const bodyHtml = `
			${this.buildChart(courses, bands, L, L.chartTitle, L.course)}
			${this.buildCourseOutcomeTable(courses, bands, totalLabel, L)}
			${this.buildAcceptanceTable(bands, L)}
		`;

		const document: ReportDocument = {
			language: request.lang,
			reportName: this.localizeValue(
				{ es: 'Informe de Percepción por Outcome LCFC', en: 'LCFC Perception by Outcome Report' },
				request.lang,
			),
			programName: programName ? this.localizeValue(programName, request.lang) : L.allPrograms,
			metadata: [
				{ label: L.period, value: periodCode ?? String(request.academicPeriodId) },
				{
					label: L.commission,
					value: commissionName
						? this.localizeValue(commissionName, request.lang)
						: L.allCommissions,
				},
				{ label: L.outcome, value: outcomeShort },
			],
			bodyHtml,
			additionalStyles: REPORT_STYLES,
		};

		const filename = `${sanitizeReportFilename(
			['Reporte', request.fileLabel, 'Percepcion_Por_Outcome', outcomeFullLabel, dateStamp()].join(
				'_',
			),
		)}.pdf`;

		const { pdf } = await this.reportGenerator.generateDocument(document, filename);

		return { filename, base64: pdf.toString('base64'), pdf };
	}

	private buildGroupDocuments(args: {
		group: SurveyNumberGroup;
		bands: AcceptanceBand[];
		request: PerceptionReportRequest;
		configuredOutcomes: ConfiguredOutcomeRow[];
		programLabel: string;
		periodCode: string;
		headerCommission: string;
		courseHeader?: CourseHeaderInfo;
		labels: (typeof LABELS)[ReportLanguage];
	}) {
		const { group, request, configuredOutcomes, labels: L } = args;

		// When a campus is selected but no commission AND the data spans multiple commissions:
		// split by commission + general. Otherwise fall back to the regular campus split.
		// Note: PerceptionReportDto requires commissionId whenever programId is set, so this
		// split path is only reachable for campus-only requests (no career filter) — it can
		// never combine with a programId.
		const distinctCommissions = new Set(
			group.rows
				.map((r) => r.commissionId)
				.filter((id): id is number => id !== null && id !== undefined),
		);
		const useCommissionSplit =
			request.campusId !== undefined &&
			request.commissionId === undefined &&
			distinctCommissions.size > 1;

		const sections = useCommissionSplit
			? this.buildCommissionSections(group.rows, request, L, configuredOutcomes)
			: this.buildCampusSections(group.rows, request, L, configuredOutcomes);

		// In commission-split mode the campus is fixed; grab its localised name from the rows.
		const fixedCampusLabel = useCommissionSplit
			? group.rows.length > 0
				? this.localizeValue(group.rows[0].campusName, request.lang)
				: L.allCampuses
			: undefined;

		return sections.map((section) => ({
			campusId: section.campusId,
			campusName: section.label,
			document: this.buildDocument({
				rows: section.rows,
				configuredOutcomes: section.configuredOutcomes,
				bands: args.bands,
				request,
				reportName: this.localizeValue(request.reportName, request.lang),
				programLabel: args.programLabel,
				periodCode: args.periodCode,
				campusLabel: useCommissionSplit ? (fixedCampusLabel ?? L.allCampuses) : section.label,
				commissionLabel: useCommissionSplit ? section.label : args.headerCommission,
				surveyNumberLabel: group.label,
				courseHeader: args.courseHeader,
				labels: L,
			}),
			filename: this.buildFilename(
				request.fileLabel,
				section.label,
				group.label,
				args.courseHeader?.courseLabel,
				args.courseHeader ? (args.courseHeader.sectionCode ?? L.all) : undefined,
			),
		}));
	}

	/**
	 * No curso filter → one group per course found in the data (NRC/docente collapsed — i.e. the
	 * course's sections are aggregated together) plus a combined "TODOS los cursos" group first,
	 * mirroring how buildCampusSections treats "no sede filter". `showCourseFilters` decides whether
	 * the combined group still carries a "CURSO: TODOS / NRC: TODOS" header (LCFC) or none (GRA/PPP).
	 */
	private buildCourseGroups(
		rows: PerceptionScoreRow[],
		lang: ReportLanguage,
		showCourseFilters: boolean,
		labels: (typeof LABELS)[ReportLanguage],
	): CourseGroup[] {
		const allGroup: CourseGroup = {
			courseHeader: showCourseFilters ? { courseLabel: labels.all, isSpecific: false } : undefined,
			rows,
		};

		const courseIds = [
			...new Set(
				rows
					.map((row) => row.courseId)
					.filter((id): id is number => id !== null && id !== undefined),
			),
		];
		if (courseIds.length === 0) return [allGroup];

		const groups: CourseGroup[] = [allGroup];
		for (const courseId of courseIds) {
			const courseRows = rows.filter((row) => row.courseId === courseId);
			const courseLabel = this.localizeValue(courseRows[0]?.courseName, lang) || String(courseId);
			groups.push({
				courseHeader: { courseLabel, isSpecific: true },
				rows: courseRows,
			});
		}
		return groups;
	}

	/**
	 * One group per survey number present in the data when the survey type asks for the split
	 * (PPP: first / second internship), so each practice gets its own PDF. Every other survey
	 * type — and PPP data with no survey number recorded — stays as a single unsplit group.
	 */
	private buildSurveyNumberGroups(
		rows: PerceptionScoreRow[],
		request: PerceptionReportRequest,
	): SurveyNumberGroup[] {
		const split = request.surveyNumberSplit;
		if (!split) return [{ label: null, rows }];

		const surveyNumbers = [
			...new Set(
				rows
					.map((row) => row.surveyNumber)
					.filter((value): value is number => value !== null && value !== undefined),
			),
		].sort((a, b) => a - b);

		if (surveyNumbers.length === 0) return [{ label: null, rows }];

		return surveyNumbers.map((surveyNumber) => ({
			label:
				this.localizeValue(split.valueLabels[surveyNumber], request.lang) || String(surveyNumber),
			rows: rows.filter((row) => row.surveyNumber === surveyNumber),
		}));
	}

	private async loadBands(
		surveyTypeId: number,
		academicPeriodId: number,
		lang: ReportLanguage,
	): Promise<AcceptanceBand[]> {
		const levels = await this.repository.getAcceptanceLevels(surveyTypeId, academicPeriodId);

		if (!levels || levels.length === 0) {
			throw new BadRequestError(perceptionReportValidationStrings.error.acceptanceLevelsMissing);
		}

		return levels
			.map((level) => ({
				name: this.localizeValue(level.name, lang),
				minScore: Number(level.minScore),
				maxScore: Number(level.maxScore),
			}))
			.sort((a, b) => a.minScore - b.minScore)
			.map((band, index) => ({ ...band, color: BAND_COLORS[index % BAND_COLORS.length] }));
	}

	private buildCommissionSections(
		rows: PerceptionScoreRow[],
		request: PerceptionReportRequest,
		labels: (typeof LABELS)[ReportLanguage],
		configuredOutcomes: ConfiguredOutcomeRow[],
	): ReportSection[] {
		const campusId = request.campusId ?? null;

		// General report (all commissions) comes first
		const sections: ReportSection[] = [
			{ campusId, label: labels.allCommissions, rows, configuredOutcomes },
		];

		const commissionIds = [
			...new Set(
				[
					...rows.map((row) => row.commissionId),
					...configuredOutcomes.map((o) => o.commissionId),
				].filter((id): id is number => id !== null && id !== undefined),
			),
		];

		for (const commissionId of commissionIds) {
			const commRows = rows.filter((row) => row.commissionId === commissionId);
			const commOutcomes = configuredOutcomes.filter((o) => o.commissionId === commissionId);
			if (commRows.length === 0 && commOutcomes.length === 0) continue;
			const commName =
				this.localizeValue(
					commRows[0]?.commissionName ?? commOutcomes[0]?.commissionName,
					request.lang,
				) || String(commissionId);
			sections.push({
				campusId,
				label: commName,
				rows: commRows,
				configuredOutcomes: commOutcomes,
			});
		}

		return sections;
	}

	private buildCampusSections(
		rows: PerceptionScoreRow[],
		request: PerceptionReportRequest,
		labels: (typeof LABELS)[ReportLanguage],
		configuredOutcomes: ConfiguredOutcomeRow[],
	): ReportSection[] {
		if (request.campusId !== undefined) {
			const label = rows.length
				? this.localizeValue(rows[0].campusName, request.lang)
				: labels.campus;
			return [{ campusId: request.campusId, label, rows, configuredOutcomes }];
		}

		const campusIds = [
			...new Set(
				rows
					.map((row) => row.campusId)
					.filter((id): id is number => id !== null && id !== undefined),
			),
		];
		// Configured outcomes aren't campus-scoped — every campus section (including "TODAS") is
		// seeded with the full configured set so a commission/outcome without a single response at
		// a given campus still shows up there with a zero count.
		const sections: ReportSection[] = [
			{ campusId: null, label: labels.allCampuses, rows, configuredOutcomes },
		];

		for (const campusId of campusIds) {
			const campusRows = rows.filter((row) => row.campusId === campusId);
			sections.push({
				campusId,
				label: this.localizeValue(campusRows[0]?.campusName, request.lang),
				rows: campusRows,
				configuredOutcomes,
			});
		}

		return sections;
	}

	private buildDocument(args: {
		rows: PerceptionScoreRow[];
		configuredOutcomes: ConfiguredOutcomeRow[];
		bands: AcceptanceBand[];
		request: PerceptionReportRequest;
		reportName: string;
		programLabel: string;
		periodCode: string;
		campusLabel: string;
		commissionLabel: string;
		surveyNumberLabel: string | null;
		courseHeader?: CourseHeaderInfo;
		labels: (typeof LABELS)[ReportLanguage];
	}): ReportDocument {
		const { rows, configuredOutcomes, bands, request, labels: L } = args;
		const modalityLabel = request.modalityLabel?.trim() || L.all;

		// A specific curso/NRC is exactly one course, which normally maps to one outcome — zero-
		// seeding every outcome configured for the whole program/commission would just pad the
		// table with unrelated empty rows, so only outcomes actually present in `rows` are kept.
		const isSpecificCourse = Boolean(args.courseHeader?.isSpecific);
		const outcomes = this.aggregateOutcomes(
			rows,
			isSpecificCourse ? [] : configuredOutcomes,
			bands,
			request.lang,
		);
		const totalLabel = this.localizeValue(request.totalLabel, request.lang);
		const chartTitle = request.chartTitle
			? this.localizeValue(request.chartTitle, request.lang)
			: L.chartTitle;

		// Same reason: with the outcome(s) already narrowed to one course, an outcome-axis chart is
		// a single redundant bar. Show the raw 1-5 response distribution instead.
		const chart = isSpecificCourse
			? this.buildScoreHistogramChart(rows, bands, L, chartTitle, L.responses)
			: this.buildChart(outcomes, bands, L, chartTitle, L.outcome);

		const bodyHtml = outcomes.length
			? `
				${chart}
				${this.buildResultsTable(outcomes, bands, totalLabel, L)}
				${this.buildAcceptanceTable(bands, L)}
			`
			: `<section><p class="report-empty">${escapeHtml(L.empty)}</p></section>`;

		const metadata: ReportMetadataItem[] = [
			{ label: L.period, value: args.periodCode },
			{ label: L.commission, value: args.commissionLabel },
			{ label: L.campus, value: args.campusLabel },
			{ label: L.modality, value: modalityLabel },
		];
		if (args.surveyNumberLabel && request.surveyNumberSplit) {
			metadata.push({
				label: this.localizeValue(request.surveyNumberSplit.label, request.lang),
				value: args.surveyNumberLabel,
			});
		}
		// Rendered as its own centered row below the period/commission/sede/modalidad line. CURSO
		// and NRC always appear together (as "TODOS" when unfiltered); DOCENTE joins them only once
		// a specific NRC/section — and therefore an actual professor — is known.
		const secondaryMetadata: ReportMetadataItem[] = [];
		if (args.courseHeader) {
			secondaryMetadata.push({ label: L.course, value: args.courseHeader.courseLabel });
			secondaryMetadata.push({ label: L.nrc, value: args.courseHeader.sectionCode ?? L.all });
			if (args.courseHeader.sectionCode) {
				secondaryMetadata.push({
					label: L.professor,
					value: args.courseHeader.professorName || '—',
				});
			}
		}

		return {
			language: request.lang,
			reportName: args.reportName,
			programName: args.programLabel,
			metadata,
			secondaryMetadata: secondaryMetadata.length ? secondaryMetadata : undefined,
			bodyHtml,
			additionalStyles: REPORT_STYLES,
		};
	}

	private aggregateOutcomes(
		rows: PerceptionScoreRow[],
		configuredOutcomes: ConfiguredOutcomeRow[],
		bands: AcceptanceBand[],
		lang: ReportLanguage,
	): OutcomeAggregate[] {
		const byOutcome = new Map<number, OutcomeAggregate>();

		// Seed every configured outcome at zero first, so ones without a single response yet still
		// show up in the chart/table instead of being silently omitted.
		for (const outcome of configuredOutcomes) {
			byOutcome.set(outcome.outcomeId, {
				code: outcome.outcomeCode,
				label: outcomeLabel(outcome.outcomeCode),
				name: this.localizeValue(outcome.outcomeName, lang),
				counts: bands.map(() => 0),
				total: 0,
				scoreSum: 0,
			});
		}

		for (const row of rows) {
			let entry = byOutcome.get(row.outcomeId);
			if (!entry) {
				entry = {
					code: row.outcomeCode,
					label: outcomeLabel(row.outcomeCode),
					name: this.localizeValue(row.outcomeName, lang),
					counts: bands.map(() => 0),
					total: 0,
					scoreSum: 0,
				};
				byOutcome.set(row.outcomeId, entry);
			}
			const score = Number(row.score);
			const bandIndex = this.bandIndexForScore(score, bands);
			entry.counts[bandIndex] += row.count;
			entry.total += row.count;
			entry.scoreSum += score * row.count;
		}

		const outcomes = [...byOutcome.values()].sort((a, b) =>
			a.code.localeCompare(b.code, undefined, { numeric: true }),
		);

		// A section spanning several commissions (campus-only request) can hold EAC-BIO-1 and
		// CAC-BIO-1 at once, which both shorten to "1". Ambiguous axis labels are worse than long
		// ones, so the whole section falls back to full codes when the short form collides.
		const shortLabels = new Set(outcomes.map((outcome) => outcome.label));
		if (shortLabels.size < outcomes.length) {
			for (const outcome of outcomes) outcome.label = outcome.code;
		}

		return outcomes;
	}

	private bandIndexForScore(score: number, bands: AcceptanceBand[]): number {
		for (let index = 0; index < bands.length; index++) {
			if (score <= bands[index].maxScore) return index;
		}
		return bands.length - 1;
	}

	private buildChart(
		outcomes: OutcomeAggregate[],
		bands: AcceptanceBand[],
		labels: (typeof LABELS)[ReportLanguage],
		title: string,
		xAxisLabel: string,
	): string {
		const chart = this.reportChart.buildGroupedBarChart({
			title,
			categories: outcomes.map((outcome) => outcome.label),
			series: bands.map((band, bandIndex) => ({
				label: band.name,
				color: band.color,
				values: outcomes.map((outcome) => outcome.counts[bandIndex]),
			})),
			yAxisLabel: labels.count,
			xAxisLabel,
			emptyLabel: labels.empty,
		});
		return `<section>${chart}</section>`;
	}

	/**
	 * For a single curso/NRC: the raw 1-5 response distribution instead of an outcome-axis chart —
	 * how many respondents picked each point on the scale, bars colored by whichever acceptance
	 * band that point falls into.
	 */
	private buildScoreHistogramChart(
		rows: PerceptionScoreRow[],
		bands: AcceptanceBand[],
		labels: (typeof LABELS)[ReportLanguage],
		title: string,
		xAxisLabel: string,
	): string {
		const scoreValues = [1, 2, 3, 4, 5];
		const countByScore = new Map<number, number>(scoreValues.map((value) => [value, 0]));
		for (const row of rows) {
			const score = Number(row.score);
			if (countByScore.has(score)) {
				countByScore.set(score, (countByScore.get(score) ?? 0) + row.count);
			}
		}
		const bandIndexByScore = scoreValues.map((value) => this.bandIndexForScore(value, bands));

		const chart = this.reportChart.buildGroupedBarChart({
			title,
			categories: scoreValues.map(String),
			series: bands.map((band, bandIndex) => ({
				label: band.name,
				color: band.color,
				values: scoreValues.map((value, valueIndex) =>
					bandIndexByScore[valueIndex] === bandIndex ? (countByScore.get(value) ?? 0) : 0,
				),
			})),
			yAxisLabel: labels.count,
			xAxisLabel,
			singleBarPerCategory: true,
			emptyLabel: labels.empty,
		});
		return `<section>${chart}</section>`;
	}

	private buildResultsTable(
		outcomes: OutcomeAggregate[],
		bands: AcceptanceBand[],
		totalLabel: string,
		labels: (typeof LABELS)[ReportLanguage],
	): string {
		const head = `
			<tr>
				<th>${escapeHtml(labels.outcome)}</th>
				${bands
					.map(
						(band) =>
							`<th class="num band-cell" style="background:${escapeHtml(band.color)}">${escapeHtml(
								band.name,
							)}</th>`,
					)
					.join('')}
				<th class="num">${escapeHtml(labels.average)}</th>
				<th class="num">${escapeHtml(totalLabel)}</th>
			</tr>`;

		const body = outcomes
			.map(
				(outcome) =>
					`<tr>
						<td class="num">${escapeHtml(outcome.label)}</td>
						${outcome.counts.map((count) => `<td class="num">${formatCountWithPercent(count, outcome.total)}</td>`).join('')}
						<td class="num">${escapeHtml(formatAverage(outcome))}</td>
						<td class="num">${outcome.total}</td>
					</tr>`,
			)
			.join('');

		return `
			<section>
				<h3>${escapeHtml(labels.resultsTitle)}</h3>
				<table><thead>${head}</thead><tbody>${body}</tbody></table>
			</section>`;
	}

	/** Results table for "Percepción por Outcome" — needs both the course name and its code,
	 *  unlike buildResultsTable's single outcome-code column. */
	private buildCourseOutcomeTable(
		courses: OutcomeAggregate[],
		bands: AcceptanceBand[],
		totalLabel: string,
		labels: (typeof LABELS)[ReportLanguage],
	): string {
		const head = `
			<tr>
				<th>${escapeHtml(labels.courseCode)}</th>
				<th>${escapeHtml(labels.course)}</th>
				${bands
					.map(
						(band) =>
							`<th class="num band-cell" style="background:${escapeHtml(band.color)}">${escapeHtml(
								band.name,
							)}</th>`,
					)
					.join('')}
				<th class="num">${escapeHtml(labels.average)}</th>
				<th class="num">${escapeHtml(totalLabel)}</th>
			</tr>`;

		const body = courses
			.map(
				(course) =>
					`<tr>
						<td>${escapeHtml(course.label)}</td>
						<td>${escapeHtml(course.name)}</td>
						${course.counts.map((count) => `<td class="num">${formatCountWithPercent(count, course.total)}</td>`).join('')}
						<td class="num">${escapeHtml(formatAverage(course))}</td>
						<td class="num">${course.total}</td>
					</tr>`,
			)
			.join('');

		return `
			<section>
				<h3>${escapeHtml(labels.resultsTitle)}</h3>
				<table class="course-outcome-table"><thead>${head}</thead><tbody>${body}</tbody></table>
			</section>`;
	}

	private buildAcceptanceTable(
		bands: AcceptanceBand[],
		labels: (typeof LABELS)[ReportLanguage],
	): string {
		const rows = bands
			.map((band, index) => {
				const isFirst = index === 0;
				const isLast = index === bands.length - 1;
				const range = isFirst
					? `[ ${formatScore(band.minScore)} - ${formatScore(band.maxScore)} >`
					: isLast
						? `< ${formatScore(band.minScore)} - ${formatScore(band.maxScore)} ]`
						: `[ ${formatScore(band.minScore)} - ${formatScore(band.maxScore)} ]`;
				return `<tr><td><span class="band-cell" style="display:inline-block;padding:1px 8px;border-radius:3px;background:${escapeHtml(
					band.color,
				)}">${escapeHtml(band.name)}</span></td><td>${escapeHtml(range)}</td></tr>`;
			})
			.join('');

		return `
			<section>
				<h3>${escapeHtml(labels.acceptanceTitle)}</h3>
				<table>
					<thead><tr><th>${escapeHtml(labels.acceptanceLevel)}</th><th>${escapeHtml(labels.values)}</th></tr></thead>
					<tbody>${rows}</tbody>
				</table>
			</section>`;
	}

	private buildFilename(
		surveyTypeCode: string,
		campusLabel: string,
		surveyNumberLabel: string | null,
		courseLabel?: string | null,
		nrcLabel?: string | null,
	): string {
		const parts = [
			'Reporte',
			surveyTypeCode,
			'Percepcion_Por_Curso',
			...(courseLabel ? [courseLabel] : []),
			...(nrcLabel ? [nrcLabel] : []),
			campusLabel,
			...(surveyNumberLabel ? [surveyNumberLabel] : []),
			dateStamp(),
		];
		return `${sanitizeReportFilename(parts.join('_'))}.pdf`;
	}

	private buildZipFilename(surveyTypeCode: string): string {
		const base = `Reportes_${surveyTypeCode}_Percepcion_Por_Curso_${dateStamp()}`;
		return `${sanitizeReportFilename(base)}.zip`;
	}

	private localizeValue(value: I18nText | string | null | undefined, lang: ReportLanguage): string {
		if (value == null) return '';
		if (typeof value === 'string') return value;
		return localize(value, lang);
	}
}

/**
 * Outcome codes are namespaced by commission (`EAC-BIO-1`), but both the old system and the
 * report's own chart axis only ever show the outcome number, so the trailing digits are the
 * label. Codes without a trailing number fall back to the full code.
 */
function outcomeLabel(code: string): string {
	const trailingNumber = /(\d+)\s*$/.exec(code ?? '');
	return trailingNumber ? trailingNumber[1] : (code ?? '');
}

function formatAverage(outcome: OutcomeAggregate): string {
	if (outcome.total === 0) return '—';
	return (outcome.scoreSum / outcome.total).toFixed(2);
}

/** "count (12.50%)" — the share of this band's count out of the row's total. */
function formatCountWithPercent(count: number, total: number): string {
	const percent = total > 0 ? (count / total) * 100 : 0;
	return `${count} (${percent.toFixed(2)}%)`;
}

function formatScore(value: number): string {
	return String(value);
}

function dateStamp(): string {
	const now = new Date();
	return `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}`;
}
