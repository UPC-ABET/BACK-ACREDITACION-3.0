import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as ExcelJS from 'exceljs';
import { normalizeCellText, sheetToObjects, type SheetRow } from 'src/libs/excel.functions';
import { PppSurveyRepository } from '../core/ppp-survey.repository';
import { PppScoreRepository } from '../core/ppp-score.repository';
import { PppConfigRepository } from '../core/ppp-config.repository';
import { PppValidation, pppUploadRowMessages } from '../core/ppp.validation';
import { pppValidationStrings } from '../config/strings/ppp.validation';
import { i18nText, i18nTrim } from 'src/shared/types/i18n';
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
const UPLOAD_JOB_STATUS_TTL_MS = 30 * 60 * 1000;
// One in-memory Map per process — see docs/CONTEXT.md § Database (single-replica constraints).
// Bounded so a burst of uploads (or a client retrying a stuck request) cannot grow it unboundedly;
// each retained job also holds a full base64 copy of the annotated Excel until its TTL expires.
const MAX_CONCURRENT_UPLOAD_JOBS = 20;

type PppUploadJobResult = {
	total: number;
	success: number;
	failed: number;
	errors: string[];
	excelWithErrors: string | null;
	fileName: string | null;
};

type PppUploadJobStatus = {
	progressPct: number;
	totalRows: number;
	processedRows: number;
	done: boolean;
	result: PppUploadJobResult | null;
};

/**
 * Labels competences as CE1..CEn (Competencia Específica) / CG1..CGn (Competencia
 * General), grouping all specific configs before general ones regardless of their
 * relative `extra.order` so the numbering never interleaves (e.g. CE1, CG1, CE2, ...).
 * Keyed by config id so callers can look up a label without relying on array order.
 */
export function buildCompetenceLabels(configs: OutcomeConfigEntity[]): Map<number, string> {
	const isSpecific = (c: OutcomeConfigEntity) =>
		c.outcome?.programCommission?.commissionType?.code === TYPE_CODES.COMMISSION_TYPE.SPECIFIC;
	const specific = configs.filter(isSpecific);
	const general = configs.filter((c) => !isSpecific(c));

	const labels = new Map<number, string>();
	specific.forEach((c, idx) => labels.set(c.id, `CE${idx + 1}`));
	general.forEach((c, idx) => labels.set(c.id, `CG${idx + 1}`));
	return labels;
}

function buildTemplateHeaders(
	configs: OutcomeConfigEntity[],
	competenceLabels: Map<number, string>,
): string[] {
	return [...FIXED_TEMPLATE_HEADERS, ...configs.map((c) => competenceLabels.get(c.id) as string)];
}

@Injectable()
export class PppSurveyService {
	private readonly logger = new Logger(PppSurveyService.name);
	private readonly uploadJobs = new Map<string, PppUploadJobStatus>();
	// Kept separate from `uploadJobs` so the owner id never leaks into the API response
	// that `getUploadStatus` returns as-is.
	private readonly uploadJobOwners = new Map<string, number>();

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
			} as any,
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
		configs.forEach((config) => {
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
	 * real progress. Validating every row against the DB (student lookup, section/
	 * campus resolution) is slow enough — for a few hundred rows — that returning
	 * only after everything finishes would leave the user staring at a spinner with
	 * no feedback. The file itself is parsed synchronously here (fast) so the caller
	 * gets an accurate `totalRows` immediately.
	 */
	async startUploadExcel(dto: UploadPppExcelDto, academicPeriodId: number, userId: number) {
		if (this.uploadJobs.size >= MAX_CONCURRENT_UPLOAD_JOBS) {
			throw new BadRequestException(pppValidationStrings.error.tooManyUploadJobs);
		}

		const [typeId, statusId] = await Promise.all([this.getPppTypeId(), this.getPppStatusId()]);

		const configs = await this.configRepo.findAllPpp({
			programId: dto.programId,
			academicPeriodId,
			isActive: true,
		});

		if (configs.length === 0) {
			throw new BadRequestException(pppValidationStrings.error.noActiveConfig);
		}
		const competenceLabels = buildCompetenceLabels(configs);

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

		const jobId = randomUUID();
		this.uploadJobs.set(jobId, {
			progressPct: 0,
			totalRows: rows.length,
			processedRows: 0,
			done: false,
			result: null,
		});
		this.uploadJobOwners.set(jobId, userId);
		this.logger.log(`PPP upload job ${jobId} queued: totalRows=${rows.length}`);

		void this.processUploadExcel({
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
		})
			.catch((err) => {
				this.logger.error(
					`PPP upload job ${jobId} failed: ${(err as Error).message}`,
					(err as Error).stack,
				);
				// The rows already validated (if any) are meaningless once the job itself
				// blew up outside the per-row try/catch below (e.g. writing the workbook
				// buffer) — without this, `done` stays false forever and the poller only
				// finds out via a 404 once the TTL below deletes the entry.
				this.finishUploadJob(jobId, {
					total: rows.length,
					success: 0,
					failed: rows.length,
					errors: [pppUploadRowMessages.saveError((err as Error).message)],
					excelWithErrors: null,
					fileName: null,
				});
			})
			.finally(() => {
				setTimeout(() => {
					this.uploadJobs.delete(jobId);
					this.uploadJobOwners.delete(jobId);
				}, UPLOAD_JOB_STATUS_TTL_MS).unref();
			});

		return { accepted: true, jobId, totalRows: rows.length };
	}

	getUploadStatus(jobId: string, userId: number): PppUploadJobStatus {
		const status = this.uploadJobs.get(jobId);
		// Same "not found" for both "never existed" and "exists but isn't yours" — an
		// unauthorized 404 (vs. 403) doesn't confirm the job id to whoever is guessing.
		if (!status || this.uploadJobOwners.get(jobId) !== userId) {
			throw new NotFoundException(pppValidationStrings.error.uploadJobNotFound);
		}
		return status;
	}

	/**
	 * Runs in the background after {@link startUploadExcel} returns. All-or-nothing
	 * semantics: every row is validated first, without writing anything; if any row
	 * is invalid, nothing is persisted and an annotated copy of the same file (one
	 * added "Errores" column) is exposed as base64 in the job result so the caller
	 * can fix and re-upload it. Only when every row passes validation are the
	 * surveys/scores actually inserted, inside a single DB transaction so a late
	 * failure (e.g. a race-condition duplicate) still rolls back everything instead
	 * of leaving a partial import.
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

		type ReadyRow = {
			studentId: number;
			practiceNumber: number;
			campusId: number;
			courseSectionId: number;
			information: Record<string, unknown>;
			scores: { outcomeId: number; score: number }[];
		};

		const readyRows = new Map<number, ReadyRow>();
		const rowErrors = new Map<number, string[]>();

		// Phase 1: validate every row without writing anything.
		for (let i = 0; i < rows.length; i++) {
			const { rowNumber: rowNum, values: row } = rows[i];
			const messages: string[] = [];

			const normalizedRow = {
				studentCode: normalizeCellText(
					row['Codigo Alumno'] ??
						row['Código Alumno'] ??
						row['CODIGO_ALUMNO'] ??
						row['student_code'],
				),
				practiceNumber: Number(
					normalizeCellText(
						row['# Practica'] ?? row['N Practica'] ?? row['practice_number'] ?? row['Practica'],
					) || 0,
				),
				totalHours:
					Number(
						normalizeCellText(
							row['Horas'] ?? row['Total Horas'] ?? row['TOTAL_HORAS'] ?? row['total_hours'],
						) || 0,
					) || null,
				companyName:
					normalizeCellText(row['Razon Social'] ?? row['Razón Social'] ?? row['company_name']) ||
					null,
				bossName: normalizeCellText(row['Nombre Jefe'] ?? row['boss_name']) || null,
				startDate: row['Fecha Inicio'] ?? row['start_date'] ?? null,
				endDate: row['Fecha Fin'] ?? row['end_date'] ?? null,
			};

			const { valid, errors } = PppValidation.validateExcelRow(normalizedRow);
			if (!valid) messages.push(...errors);

			let studentId: number | null = null;
			if (messages.length === 0) {
				const student = await this.surveyRepo.findStudentByCode(normalizedRow.studentCode);
				if (!student) {
					messages.push(pppUploadRowMessages.studentNotFound(normalizedRow.studentCode));
				} else {
					studentId = student.id;
				}
			}

			// campus_id and course_section_id are NOT NULL FKs on the survey; the Excel
			// does not provide them, so resolve them from the student (or a fallback).
			let placement: { courseSectionId: number; campusId: number } | null = null;
			if (studentId !== null) {
				placement = await this.surveyRepo.resolveCourseSectionAndCampus(studentId);
				if (!placement) {
					messages.push(pppUploadRowMessages.noCourseSection);
				}
			}

			// Extract scores from Excel columns (one column per outcome config, matched by its CE/CG label)
			const scores: { outcomeId: number; score: number }[] = [];
			configs.forEach((config) => {
				const colName = competenceLabels.get(config.id) as string;
				const altColName = config.userOutcomeName as unknown as string;
				const rawScore = normalizeCellText(row[colName] ?? row[altColName]);
				const score = rawScore !== '' ? parseFloat(rawScore) : null;

				if (score !== null && !isNaN(score) && score >= 1 && score <= 5) {
					scores.push({ outcomeId: config.outcomeId, score });
				}
			});

			if (messages.length > 0) {
				rowErrors.set(rowNum, messages);
			} else {
				readyRows.set(rowNum, {
					studentId: studentId as number,
					practiceNumber: Number(normalizedRow.practiceNumber),
					campusId: dto.campusId || (placement as { campusId: number }).campusId,
					courseSectionId: (placement as { courseSectionId: number }).courseSectionId,
					information: {
						companyName: normalizedRow.companyName,
						bossName: normalizedRow.bossName,
						totalHours: normalizedRow.totalHours,
						startDate: normalizedRow.startDate,
						endDate: normalizedRow.endDate,
					},
					scores,
				});
			}

			this.updateUploadProgress(jobId, rows.length, i + 1);
		}

		if (rowErrors.size > 0) {
			const result = await this.buildUploadErrorResult(
				workbook,
				worksheet,
				rows.length,
				rowErrors,
				dto,
				academicPeriodId,
			);
			this.finishUploadJob(jobId, result);
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
							information: r.information as any,
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
			const message = pppUploadRowMessages.saveError((err as Error).message);
			for (const rowNum of readyRows.keys()) rowErrors.set(rowNum, [message]);
			const result = await this.buildUploadErrorResult(
				workbook,
				worksheet,
				rows.length,
				rowErrors,
				dto,
				academicPeriodId,
			);
			this.finishUploadJob(jobId, result);
			return;
		}

		this.finishUploadJob(jobId, {
			total: rows.length,
			success: readyRows.size,
			failed: 0,
			errors: [],
			excelWithErrors: null,
			fileName: null,
		});
	}

	/** Real progress: the share of rows actually validated so far, capped at 90% —
	 *  the remaining 10% is reserved for the commit transaction that follows, so the
	 *  bar never reads 100% before the data is actually saved. */
	private updateUploadProgress(jobId: string, total: number, processed: number): void {
		const current = this.uploadJobs.get(jobId);
		if (!current) return;
		this.uploadJobs.set(jobId, {
			...current,
			processedRows: processed,
			progressPct: Math.min(90, Math.round((processed / total) * 90)),
		});
	}

	private finishUploadJob(jobId: string, result: PppUploadJobResult): void {
		const current = this.uploadJobs.get(jobId);
		this.uploadJobs.set(jobId, {
			progressPct: 100,
			totalRows: current?.totalRows ?? result.total,
			processedRows: current?.totalRows ?? result.total,
			done: true,
			result,
		});
	}

	private async buildUploadErrorResult(
		workbook: ExcelJS.Workbook,
		worksheet: ExcelJS.Worksheet,
		totalRows: number,
		rowErrors: Map<number, string[]>,
		dto: UploadPppExcelDto,
		academicPeriodId: number,
	) {
		annotateUploadErrors(worksheet, rowErrors);
		const buffer = await workbook.xlsx.writeBuffer();

		return {
			total: totalRows,
			success: 0,
			failed: rowErrors.size,
			errors: Array.from(rowErrors.entries()).flatMap(([rowNum, messages]) =>
				messages.map((m) => `Row ${rowNum}: ${m}`),
			),
			excelWithErrors: Buffer.from(buffer).toString('base64'),
			fileName: `errores_ppp_${dto.programId}_${academicPeriodId}.xlsx`,
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

/**
 * Appends an "Errores" column to the uploaded workbook, one joined message per
 * failed row. The column is placed right after whatever columns the *uploaded*
 * sheet actually has (reusing an existing "Errores" header if the file was
 * already annotated once) rather than after the template's column count — the
 * parser accepts files with extra or missing columns (alternate headers, a
 * `userOutcomeName` fallback for scores), so the template's shape and the
 * uploaded sheet's shape can legitimately differ. A free function (not a class
 * method) so it only depends on its arguments and is trivially unit-testable.
 */
export function annotateUploadErrors(
	worksheet: ExcelJS.Worksheet,
	rowErrors: Map<number, string[]>,
): void {
	const headerRow = worksheet.getRow(1);
	let errorColumn = worksheet.columnCount + 1;
	headerRow.eachCell((cell, col) => {
		if (normalizeCellText(cell.value) === ERRORS_COLUMN_HEADER) errorColumn = col;
	});

	const headerCell = headerRow.getCell(errorColumn);
	headerCell.value = ERRORS_COLUMN_HEADER;
	headerCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
	headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
	worksheet.getColumn(errorColumn).width = 60;

	for (const [rowNum, messages] of rowErrors) {
		worksheet.getRow(rowNum).getCell(errorColumn).value = messages.join(' | ');
	}
}
