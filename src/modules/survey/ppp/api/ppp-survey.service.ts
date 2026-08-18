import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
	annotateRowErrors,
	normalizeCellText,
	sheetToObjects,
	type SheetRow,
} from 'src/libs/excel.functions';
import { PppSurveyRepository } from '../core/ppp-survey.repository';
import { PppScoreRepository } from '../core/ppp-score.repository';
import { PppConfigRepository } from '../core/ppp-config.repository';
import { PppValidation, type PppExcelRow } from '../core/ppp.validation';
import { pppValidationStrings } from '../config/strings/ppp.validation';
import {
	renderPppUploadRowError,
	type PppUploadRowError,
	type PppUploadRowErrorItem,
} from '../config/strings/ppp-upload-messages';
import { JobRegistry } from 'src/modules/survey/shared/core/job-registry';
import { i18nText, i18nTrim, type I18nText } from 'src/shared/types/i18n';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';
import {
	CreatePppSurveyDto,
	FilterPppSurveyDto,
	UploadPppExcelDto,
	DashboardPppDto,
	GenerateFindingsPppDto,
} from '../model/ppp.dtos';

const PPP_TYPE_CODE = TYPE_CODES.SURVEY_TYPE.PPP;
const PPP_STATUS_ACTIVE_CODE = 'TG602-T001';

// The bulk template is intentionally lighter than the manual form: it omits `ruc`, `bossRole`,
// `phone` and `email`, so a bulk-imported survey stores five `information` keys where `create`
// stores nine. Those four remain in `CreatePppSurveyDto` — they are out of scope for the import,
// not for PPP — which is why the 11-digit RUC rule lives in `validateCreateSurvey` alone.
const FIXED_TEMPLATE_HEADERS = [
	'Codigo Alumno',
	'# Practica',
	'Horas',
	'Razon Social',
	'Nombre Jefe',
	'Fecha Inicio',
	'Fecha Fin',
];
const ERRORS_COLUMN_HEADER = 'Errores';
// Bounds for the upload job registry; what each one defends against is documented on
// `JobRegistry`, and why they live in this process at all on docs/CONTEXT.md § Database.
const UPLOAD_JOB_STATUS_TTL_MS = 30 * 60 * 1000;
const MAX_CONCURRENT_UPLOAD_JOBS = 20;
const MAX_CONCURRENT_UPLOAD_JOBS_PER_USER = 3;
const MAX_RETAINED_UPLOAD_JOBS = 100;
// The bar is split across the three stages that actually take time. The batched
// lookups own the first stretch and the commit transaction the last, so the bar
// neither sits at 0 while the queries run nor reads 100% before the data is saved.
// Row validation itself is in-memory and would otherwise complete in a single tick.
const LOOKUP_SHARE_OF_PROGRESS = 40;
const VALIDATION_SHARE_OF_PROGRESS = 90;

type PppUploadJobResult = {
	total: number;
	success: number;
	failed: number;
	errors: PppUploadRowErrorItem[];
	fileName: string | null;
	hasErrorFile: boolean;
};

type PppUploadJobState = {
	progressPct: number;
	totalRows: number;
	processedRows: number;
	result: PppUploadJobResult | null;
	/** The annotated workbook. Held here but never returned by the status poll — the
	 *  client polls once a second and this is the whole file; `getUploadErrorFile`
	 *  serves it once instead. */
	errorFile: Buffer | null;
};

export type PppUploadJobStatus = Omit<PppUploadJobState, 'errorFile'> & { done: boolean };

/**
 * Orders configs the way the competence columns are numbered: every specific one
 * (CE) before every general one (CG), so neither the labels nor the columns they
 * head interleave when the two kinds share an `extra.order`.
 */
export function orderConfigsByCompetence(configs: OutcomeConfigEntity[]): OutcomeConfigEntity[] {
	const isSpecific = (c: OutcomeConfigEntity) =>
		c.outcome?.programCommission?.commissionType?.code === TYPE_CODES.COMMISSION_TYPE.SPECIFIC;
	return [...configs.filter(isSpecific), ...configs.filter((c) => !isSpecific(c))];
}

/** Labels competences as CE1..CEn (Competencia Específica) / CG1..CGn (Competencia
 *  General), keyed by config id so callers never depend on array order. */
export function buildCompetenceLabels(configs: OutcomeConfigEntity[]): Map<number, string> {
	const labels = new Map<number, string>();
	let specificCount = 0;
	let generalCount = 0;

	for (const config of orderConfigsByCompetence(configs)) {
		const isSpecific =
			config.outcome?.programCommission?.commissionType?.code ===
			TYPE_CODES.COMMISSION_TYPE.SPECIFIC;
		labels.set(config.id, isSpecific ? `CE${++specificCount}` : `CG${++generalCount}`);
	}

	return labels;
}

function buildTemplateHeaders(
	configs: OutcomeConfigEntity[],
	competenceLabels: Map<number, string>,
): string[] {
	return [
		...FIXED_TEMPLATE_HEADERS,
		...orderConfigsByCompetence(configs).map((c) => competenceLabels.get(c.id) as string),
	];
}

@Injectable()
export class PppSurveyService {
	private readonly logger = new Logger(PppSurveyService.name);
	private readonly uploadJobs = new JobRegistry<PppUploadJobState>({
		ttlMs: UPLOAD_JOB_STATUS_TTL_MS,
		maxConcurrent: MAX_CONCURRENT_UPLOAD_JOBS,
		maxConcurrentPerOwner: MAX_CONCURRENT_UPLOAD_JOBS_PER_USER,
		maxRetained: MAX_RETAINED_UPLOAD_JOBS,
	});

	constructor(
		private readonly surveyRepo: PppSurveyRepository,
		private readonly scoreRepo: PppScoreRepository,
		private readonly configRepo: PppConfigRepository,
	) {}

	private async getPppTypeId(): Promise<number> {
		const id = await this.surveyRepo.getPppTypeId(PPP_TYPE_CODE);
		if (!id) throw new BadRequestException(pppValidationStrings.error.surveyTypeMissing);
		return id;
	}

	private async getPppStatusId(): Promise<number> {
		const id = await this.surveyRepo.getPppStatusTypeId(PPP_STATUS_ACTIVE_CODE);
		if (!id) throw new BadRequestException(pppValidationStrings.error.surveyStatusMissing);
		return id;
	}

	async create(dto: CreatePppSurveyDto, academicPeriodId: number) {
		PppValidation.validateCreateSurvey(dto);

		const [typeId, statusId] = await Promise.all([this.getPppTypeId(), this.getPppStatusId()]);

		const survey = await this.surveyRepo.create({
			surveyTypeId: typeId,
			surveyStatusTypeId: statusId,
			studentId: dto.studentId,
			academicPeriodId,
			campusId: dto.campusId,
			programId: dto.programId,
			surveyNumber: dto.practiceNumber,
			information: {
				companyName: dto.companyName ?? null,
				bossName: dto.bossName ?? null,
				bossRole: dto.bossRole ?? null,
				phone: dto.phone ?? null,
				email: dto.email ?? null,
				ruc: dto.ruc ?? null,
				totalHours: dto.totalHours ?? null,
				startDate: dto.startDate ?? null,
				endDate: dto.endDate ?? null,
			} as unknown as I18nText,
			courseSectionId: 1,
		});

		if (dto.scores?.length) {
			await this.scoreRepo.bulkCreate(
				dto.scores.map((s) => ({
					surveyId: survey.id,
					outcomeId: s.outcomeId,
					score: s.score,
					...(s.commentaries !== undefined && { commentaries: i18nText(s.commentaries) }),
				})),
			);
		}

		return { surveyId: survey.id, scoresCreated: dto.scores?.length ?? 0 };
	}

	async getAll() {
		const typeId = await this.getPppTypeId();
		return await this.surveyRepo.findAllPpp(typeId);
	}

	async getById(id: number) {
		const typeId = await this.getPppTypeId();
		const survey = await this.surveyRepo.findOnePpp(id, typeId);
		if (!survey) throw new NotFoundException(pppValidationStrings.error.surveyNotFound);

		const scores = await this.scoreRepo.findBySurveyId(id);
		return { ...survey, scores };
	}

	async getByFilters(dto: FilterPppSurveyDto & { academicPeriodId?: number | null }) {
		const typeId = await this.getPppTypeId();
		return await this.surveyRepo.findAllPpp(typeId, {
			...dto,
			academicPeriodId: dto.academicPeriodId ?? undefined,
		});
	}

	/**
	 * Builds the PPP bulk-import Excel template: the fixed data columns plus one
	 * "CE"/"CG" column per active config (same headers uploadExcel parses).
	 * A second sheet lists which competency each column maps to.
	 */
	async generateTemplate(
		academicPeriodId: number,
		programId?: number,
	): Promise<{ buffer: Buffer; fileName: string }> {
		const configs = await this.configRepo.findAllPpp({
			programId,
			academicPeriodId,
			isActive: true,
		});
		const competenceLabels = buildCompetenceLabels(configs);
		const headers = buildTemplateHeaders(configs, competenceLabels);

		const workbook = new ExcelJS.Workbook();

		const dataSheet = workbook.addWorksheet('Plantilla');
		dataSheet.addRow(headers);

		const legendSheet = workbook.addWorksheet('Competencias');
		legendSheet.addRow(['Columna', 'Competencia']);
		orderConfigsByCompetence(configs).forEach((config) => {
			legendSheet.addRow([competenceLabels.get(config.id), i18nTrim(config.userOutcomeName) ?? '']);
		});

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		const fileName = programId
			? `plantilla_ppp_${programId}_${academicPeriodId}.xlsx`
			: `plantilla_ppp_${academicPeriodId}.xlsx`;
		return { buffer, fileName };
	}

	/**
	 * Kicks off the bulk import in the background and returns a job id to poll for
	 * real progress. Even with every lookup batched, validating and committing a few
	 * hundred rows takes long enough that returning only at the end would leave the
	 * user staring at a spinner; the file is parsed up front so the caller gets an
	 * accurate `totalRows` with the job id.
	 */
	async startUploadExcel(dto: UploadPppExcelDto, academicPeriodId: number, userId: number) {
		if (!this.uploadJobs.hasCapacity(userId)) {
			throw new BadRequestException(pppValidationStrings.error.tooManyUploadJobs);
		}
		// Registered before the first `await` — see `JobRegistry.register`.
		const jobId = this.uploadJobs.register(userId, {
			progressPct: 0,
			totalRows: 0,
			processedRows: 0,
			result: null,
			errorFile: null,
		});

		let prepared: Awaited<ReturnType<PppSurveyService['prepareUpload']>>;
		try {
			prepared = await this.prepareUpload(dto, academicPeriodId);
		} catch (err) {
			// The upload never started, so it must not hold a running slot until its TTL.
			this.uploadJobs.remove(jobId);
			throw err;
		}

		const totalRows = prepared.rows.length;
		this.uploadJobs.patch(jobId, { totalRows });
		this.logger.log(`PPP upload job ${jobId} queued: totalRows=${totalRows}`);

		void this.processUploadExcel({ ...prepared, dto, academicPeriodId, jobId })
			.catch((err) => {
				this.logger.error(
					`PPP upload job ${jobId} failed: ${(err as Error).message}`,
					(err as Error).stack,
				);
				// The rows already validated (if any) are meaningless once the job itself
				// blew up outside the per-row handling below (e.g. writing the workbook
				// buffer) — without this, `done` stays false forever and the poller only
				// finds out via a 404 once the TTL deletes the entry.
				this.finishUploadJob(jobId, totalRows, {
					total: totalRows,
					success: 0,
					failed: totalRows,
					errors: [
						{
							row: 0,
							key: pppValidationStrings.error.upload.saveFailed,
							args: { reason: (err as Error).message },
						},
					],
					fileName: null,
					hasErrorFile: false,
				});
			})
			// Guarantees the entry is marked done and scheduled for eviction on every
			// path; `finish` is idempotent, so the normal completion above still wins.
			.finally(() => this.uploadJobs.finish(jobId));

		return { accepted: true, jobId, totalRows };
	}

	private async prepareUpload(dto: UploadPppExcelDto, academicPeriodId: number) {
		const [typeId, statusId] = await Promise.all([this.getPppTypeId(), this.getPppStatusId()]);

		const configs = await this.configRepo.findAllPpp({
			programId: dto.programId,
			academicPeriodId,
			isActive: true,
		});

		if (configs.length === 0) {
			throw new BadRequestException(pppValidationStrings.error.noActiveConfig);
		}

		const workbook = new ExcelJS.Workbook();
		try {
			// Accept both a raw base64 string and a data URI (e.g. "data:...;base64,XXXX")
			// produced by FileReader.readAsDataURL on the frontend.
			const base64 = dto.fileBase64.includes(',')
				? dto.fileBase64.slice(dto.fileBase64.indexOf(',') + 1)
				: dto.fileBase64;
			const buffer = Buffer.from(base64.trim(), 'base64');
			await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
		} catch {
			throw new BadRequestException(pppValidationStrings.error.invalidExcelFile);
		}

		const worksheet = workbook.worksheets[0];
		if (!worksheet) throw new BadRequestException(pppValidationStrings.error.excelNoSheets);

		const rows = sheetToObjects(worksheet);
		if (rows.length === 0) throw new BadRequestException(pppValidationStrings.error.excelEmpty);

		return {
			typeId,
			statusId,
			configs,
			competenceLabels: buildCompetenceLabels(configs),
			workbook,
			worksheet,
			rows,
		};
	}

	getUploadStatus(jobId: string, userId: number): PppUploadJobStatus {
		const status = this.uploadJobs.get(jobId, userId);
		if (!status) {
			throw new NotFoundException(pppValidationStrings.error.uploadJobNotFound);
		}
		return {
			progressPct: status.progressPct,
			totalRows: status.totalRows,
			processedRows: status.processedRows,
			done: status.done,
			result: status.result,
		};
	}

	getUploadErrorFile(jobId: string, userId: number): { buffer: Buffer; fileName: string } {
		const status = this.uploadJobs.get(jobId, userId);
		if (!status) {
			throw new NotFoundException(pppValidationStrings.error.uploadJobNotFound);
		}
		if (!status.errorFile || !status.result?.fileName) {
			throw new NotFoundException(pppValidationStrings.error.uploadErrorFileNotFound);
		}
		return { buffer: status.errorFile, fileName: status.result.fileName };
	}

	/**
	 * Runs in the background after {@link startUploadExcel} returns. All-or-nothing
	 * semantics: every row is validated first, without writing anything; if any row
	 * is invalid, nothing is persisted and an annotated copy of the same file (one
	 * added "Errores" column) is kept for {@link getUploadErrorFile} so the caller
	 * can fix and re-upload it. Only when every row passes validation are the
	 * surveys/scores actually inserted, inside a single DB transaction so a late
	 * failure still rolls back everything instead of leaving a partial import.
	 */
	private async processUploadExcel(ctx: {
		dto: UploadPppExcelDto;
		academicPeriodId: number;
		typeId: number;
		statusId: number;
		configs: OutcomeConfigEntity[];
		competenceLabels: Map<number, string>;
		workbook: ExcelJS.Workbook;
		worksheet: ExcelJS.Worksheet;
		rows: SheetRow[];
		jobId: string;
	}): Promise<void> {
		const {
			dto,
			academicPeriodId,
			typeId,
			statusId,
			configs,
			competenceLabels,
			workbook,
			worksheet,
			rows,
			jobId,
		} = ctx;

		const parsed = rows.map((sheetRow) => ({
			rowNumber: sheetRow.rowNumber,
			values: sheetRow.values,
			row: normalizeUploadRow(sheetRow.values),
		}));

		const rowErrors = new Map<number, PppUploadRowError[]>();
		const shapeErrors = new Map<number, PppUploadRowError[]>();
		for (const { rowNumber, row } of parsed) {
			const { valid, errors } = PppValidation.validateExcelRow(row);
			if (!valid) shapeErrors.set(rowNumber, errors);
		}

		// Every lookup phase 1 needs, batched: one query for the students, one for their
		// placements, one for the practices already registered. Per row this was two
		// round-trips each — the N+1 that made the job slow enough to need a progress
		// bar in the first place.
		const codes = [
			...new Set(parsed.filter((p) => !shapeErrors.has(p.rowNumber)).map((p) => p.row.studentCode)),
		];
		const students = await this.surveyRepo.findStudentsByCodes(codes);
		const studentIdByCode = new Map(students.map((s) => [s.code, s.id]));
		const studentIds = [...new Set(students.map((s) => s.id))];

		const [placements, registered] = await Promise.all([
			this.surveyRepo.findCourseSectionAndCampusByStudents(studentIds),
			this.surveyRepo.findExistingPracticeKeys(typeId, academicPeriodId, dto.programId, studentIds),
		]);
		const placementByStudent = new Map(placements.map((p) => [p.studentId, p]));
		const registeredPractices = new Set(
			registered.map((r) => practiceKey(r.studentId, r.practiceNumber)),
		);
		// Only worth a query when at least one student has no enrolment of their own.
		const fallbackPlacement =
			placements.length < studentIds.length
				? await this.surveyRepo.findFallbackCourseSection()
				: null;

		this.uploadJobs.patch(jobId, { progressPct: LOOKUP_SHARE_OF_PROGRESS });

		const readyRows = new Map<number, ReadyRow>();
		const firstRowOfPractice = new Map<string, number>();

		parsed.forEach(({ rowNumber, values, row }, index) => {
			const messages: PppUploadRowError[] = [...(shapeErrors.get(rowNumber) ?? [])];

			const studentId =
				messages.length === 0 ? (studentIdByCode.get(row.studentCode) ?? null) : null;
			if (messages.length === 0 && studentId === null) {
				messages.push({
					key: pppValidationStrings.error.upload.studentNotFound,
					args: { code: row.studentCode },
				});
			}

			// campus_id and course_section_id are NOT NULL FKs on the survey; the Excel
			// does not provide them, so resolve them from the student (or a fallback).
			const placement =
				studentId !== null ? (placementByStudent.get(studentId) ?? fallbackPlacement) : null;
			if (studentId !== null && !placement) {
				messages.push({ key: pppValidationStrings.error.upload.noCourseSection });
			}

			if (studentId !== null) {
				const key = practiceKey(studentId, row.practiceNumber);
				if (registeredPractices.has(key)) {
					messages.push({
						key: pppValidationStrings.error.upload.duplicateSurvey,
						args: { code: row.studentCode, practiceNumber: row.practiceNumber },
					});
				}
				const firstRow = firstRowOfPractice.get(key);
				if (firstRow !== undefined) {
					messages.push({
						key: pppValidationStrings.error.upload.duplicateInFile,
						args: { code: row.studentCode, practiceNumber: row.practiceNumber, firstRow },
					});
				} else {
					firstRowOfPractice.set(key, rowNumber);
				}
			}

			// One column per outcome config, matched by its CE/CG label. A cell that is
			// filled but unreadable is an error, never a silently dropped score: these
			// are the whole payload of the survey, and `validateCreateSurvey` rejects the
			// same values on the manual path.
			const scores: { outcomeId: number; score: number }[] = [];
			let filledScoreCells = 0;
			for (const config of configs) {
				const label = competenceLabels.get(config.id) as string;
				const altLabel = config.userOutcomeName as unknown as string;
				const rawScore = normalizeCellText(values[label] ?? values[altLabel]);
				if (rawScore === '') continue;

				filledScoreCells++;
				const { score, error } = PppValidation.validateExcelScore(rawScore, label);
				if (error) messages.push(error);
				else scores.push({ outcomeId: config.outcomeId, score: score as number });
			}
			if (filledScoreCells === 0) {
				messages.push({ key: pppValidationStrings.error.upload.noScores });
			}

			if (messages.length > 0) {
				rowErrors.set(rowNumber, messages);
			} else {
				readyRows.set(rowNumber, {
					studentId: studentId as number,
					practiceNumber: row.practiceNumber,
					campusId: dto.campusId || (placement as { campusId: number }).campusId,
					courseSectionId: (placement as { courseSectionId: number }).courseSectionId,
					// Deliberately five keys, against the nine that `create` writes: the bulk
					// template is the lighter path and does not collect `ruc`, `bossRole`,
					// `phone` or `email` (see FIXED_TEMPLATE_HEADERS). Those four stay valid on
					// the manual form, which is why `validateCreateSurvey` still enforces the RUC
					// format there — there is simply nothing to validate here. Anything reading
					// `information` back for PPP must treat all four as optional.
					information: {
						companyName: row.companyName,
						bossName: row.bossName,
						totalHours: row.totalHours,
						startDate: row.startDate,
						endDate: row.endDate,
					},
					scores,
				});
			}

			this.updateUploadProgress(jobId, rows.length, index + 1);
		});

		if (rowErrors.size > 0) {
			const { result, errorFile } = await this.buildUploadErrorResult(
				workbook,
				worksheet,
				rows.length,
				rowErrors,
				dto,
				academicPeriodId,
			);
			this.finishUploadJob(jobId, rows.length, result, errorFile);
			return;
		}

		// Phase 2: every row is valid — persist all of them atomically. If anything
		// unexpected fails here, the transaction rolls back and none of it is kept.
		try {
			await this.surveyRepo.transaction(async (manager) => {
				for (const [, r] of readyRows) {
					const survey = await this.surveyRepo.create(
						{
							surveyTypeId: typeId,
							surveyStatusTypeId: statusId,
							studentId: r.studentId,
							academicPeriodId,
							campusId: r.campusId,
							programId: dto.programId,
							surveyNumber: r.practiceNumber,
							information: r.information as unknown as I18nText,
							courseSectionId: r.courseSectionId,
						},
						manager,
					);

					if (r.scores.length > 0) {
						await this.scoreRepo.bulkCreate(
							r.scores.map((s) => ({ ...s, surveyId: survey.id })),
							manager,
						);
					}
				}
			});
		} catch (err) {
			// Nothing was committed (the transaction rolled back); flag every row so the
			// downloaded file makes clear none of it was saved.
			const message: PppUploadRowError = {
				key: pppValidationStrings.error.upload.saveFailed,
				args: { reason: (err as Error).message },
			};
			for (const rowNumber of readyRows.keys()) rowErrors.set(rowNumber, [message]);
			const { result, errorFile } = await this.buildUploadErrorResult(
				workbook,
				worksheet,
				rows.length,
				rowErrors,
				dto,
				academicPeriodId,
			);
			this.finishUploadJob(jobId, rows.length, result, errorFile);
			return;
		}

		this.finishUploadJob(jobId, rows.length, {
			total: rows.length,
			success: readyRows.size,
			failed: 0,
			errors: [],
			fileName: null,
			hasErrorFile: false,
		});
	}

	private updateUploadProgress(jobId: string, total: number, processed: number): void {
		const validationSpan = VALIDATION_SHARE_OF_PROGRESS - LOOKUP_SHARE_OF_PROGRESS;
		this.uploadJobs.patch(jobId, {
			processedRows: processed,
			progressPct: Math.min(
				VALIDATION_SHARE_OF_PROGRESS,
				LOOKUP_SHARE_OF_PROGRESS + Math.round((processed / total) * validationSpan),
			),
		});
	}

	private finishUploadJob(
		jobId: string,
		totalRows: number,
		result: PppUploadJobResult,
		errorFile: Buffer | null = null,
	): void {
		this.uploadJobs.finish(jobId, {
			progressPct: 100,
			totalRows,
			processedRows: totalRows,
			result,
			errorFile,
		});
	}

	private async buildUploadErrorResult(
		workbook: ExcelJS.Workbook,
		worksheet: ExcelJS.Worksheet,
		totalRows: number,
		rowErrors: Map<number, PppUploadRowError[]>,
		dto: UploadPppExcelDto,
		academicPeriodId: number,
	): Promise<{ result: PppUploadJobResult; errorFile: Buffer }> {
		// The spreadsheet is the one surface the backend renders itself, so keys become
		// words here and nowhere else; the API keeps returning the keys.
		annotateRowErrors(
			worksheet,
			new Map(
				[...rowErrors].map(([rowNumber, errors]) => [
					rowNumber,
					errors.map((error) => renderPppUploadRowError(error)),
				]),
			),
			ERRORS_COLUMN_HEADER,
		);
		const errorFile = Buffer.from(await workbook.xlsx.writeBuffer());

		return {
			result: {
				total: totalRows,
				success: 0,
				failed: rowErrors.size,
				errors: [...rowErrors].flatMap(([row, errors]) =>
					errors.map((error) => ({ row, ...error })),
				),
				fileName: `errores_ppp_${dto.programId}_${academicPeriodId}.xlsx`,
				hasErrorFile: true,
			},
			errorFile,
		};
	}

	async getDashboard(dto: DashboardPppDto & { academicPeriodId?: number | null }) {
		const typeId = await this.getPppTypeId();

		const filters = { ...dto, academicPeriodId: dto.academicPeriodId ?? undefined };

		const [surveyCount, dashboardData] = await Promise.all([
			this.surveyRepo.findAllPpp(typeId, filters).then((r) => r.length),
			this.surveyRepo.getDashboardData(typeId, filters),
		]);

		const outcomeResults = dashboardData.map((row) => ({
			outcomeId: row.outcomeId,
			outcomeName: row.outcomeName,
			avgScore: parseFloat(String(row.avgScore)),
			totalSurveys: row.totalSurveys,
			color: PppValidation.classifyScore(parseFloat(String(row.avgScore))),
		}));

		const summary = {
			totalSurveys: surveyCount,
			outcomesAnalyzed: outcomeResults.length,
			rojo: outcomeResults.filter((o) => o.color === 'ROJO').length,
			amarillo: outcomeResults.filter((o) => o.color === 'AMARILLO').length,
			verde: outcomeResults.filter((o) => o.color === 'VERDE').length,
		};

		return { summary, outcomes: outcomeResults, filters };
	}

	async generateFindings(dto: GenerateFindingsPppDto, academicPeriodId: number) {
		const typeId = await this.getPppTypeId();

		const dashboardData = await this.surveyRepo.getDashboardData(typeId, {
			programId: dto.programId,
			academicPeriodId,
			campusId: dto.campusId,
			practiceNumber: dto.practiceNumber,
		});

		if (dashboardData.length === 0) {
			return { findings: [], message: 'No PPP survey data found for the selected filters' };
		}

		const findings = dashboardData.map((row) => {
			const avgScore = parseFloat(String(row.avgScore));
			const color = PppValidation.classifyScore(avgScore);

			let severity: string;
			let recommendation: string;

			if (color === 'ROJO') {
				severity = 'HIGH';
				recommendation = `Outcome "${row.outcomeName}" has a critical average score (${avgScore.toFixed(2)}). Immediate intervention and an improvement plan are required.`;
			} else if (color === 'AMARILLO') {
				severity = 'MEDIUM';
				recommendation = `Outcome "${row.outcomeName}" has an at-risk average score (${avgScore.toFixed(2)}). Follow-up and preventive actions are recommended.`;
			} else {
				severity = 'LOW';
				recommendation = `Outcome "${row.outcomeName}" meets the acceptance threshold (${avgScore.toFixed(2)}). Maintain the current level.`;
			}

			return {
				outcomeId: row.outcomeId,
				outcomeName: row.outcomeName,
				avgScore,
				totalSurveys: row.totalSurveys,
				color,
				severity,
				recommendation,
				thresholds: { rojo: '< 2.5', amarillo: '2.5 – 3.19', verde: '≥ 3.2' },
			};
		});

		const criticalFindings = findings.filter((f) => f.color !== 'VERDE');

		return {
			findings,
			summary: {
				totalOutcomes: findings.length,
				critical: findings.filter((f) => f.color === 'ROJO').length,
				alert: findings.filter((f) => f.color === 'AMARILLO').length,
				acceptable: findings.filter((f) => f.color === 'VERDE').length,
			},
			requiresAction: criticalFindings.length > 0,
			message:
				criticalFindings.length > 0
					? `${criticalFindings.length} outcome(s) require attention (RED/YELLOW)`
					: 'All outcomes are within the acceptance threshold',
		};
	}
}

type ReadyRow = {
	studentId: number;
	practiceNumber: number;
	campusId: number;
	courseSectionId: number;
	information: Record<string, unknown>;
	scores: { outcomeId: number; score: number }[];
};

/** A student may hold at most one survey per practice number in a given programme
 *  and period; this is the key both the in-file and the already-registered
 *  duplicate checks compare on. */
function practiceKey(studentId: number, practiceNumber: number): string {
	return `${studentId}:${practiceNumber}`;
}

/** Resolves the header aliases the importer accepts into one shape. Pure, so the
 *  validation pass can run before any of the batched lookups. */
function normalizeUploadRow(values: Record<string, ExcelJS.CellValue>): PppExcelRow {
	return {
		studentCode: normalizeCellText(
			values['Codigo Alumno'] ??
				values['Código Alumno'] ??
				values['CODIGO_ALUMNO'] ??
				values['student_code'],
		),
		practiceNumber: Number(
			normalizeCellText(
				values['# Practica'] ??
					values['N Practica'] ??
					values['practice_number'] ??
					values['Practica'],
			) || 0,
		),
		totalHours:
			Number(
				normalizeCellText(
					values['Horas'] ??
						values['Total Horas'] ??
						values['TOTAL_HORAS'] ??
						values['total_hours'],
				) || 0,
			) || null,
		companyName:
			normalizeCellText(
				values['Razon Social'] ?? values['Razón Social'] ?? values['company_name'],
			) || null,
		bossName: normalizeCellText(values['Nombre Jefe'] ?? values['boss_name']) || null,
		startDate: values['Fecha Inicio'] ?? values['start_date'] ?? null,
		endDate: values['Fecha Fin'] ?? values['end_date'] ?? null,
	};
}
