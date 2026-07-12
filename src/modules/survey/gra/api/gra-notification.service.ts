import {
	Injectable,
	BadRequestException,
	Logger,
	NotFoundException,
	InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { randomUUID } from 'crypto';
import * as ExcelJS from 'exceljs';
import { normalizeCellText, sheetToObjects } from 'src/libs/excel.functions';
import { MailService } from 'src/modules/mail/mail.service';
import { SurveyEmailTemplateService } from 'src/modules/survey/shared/survey-email.service';
import { SURVEY_FRONTEND_PATHS } from 'src/modules/survey/shared/survey-frontend-paths';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { GraNotificationRepository } from '../core/gra-notification.repository';
import { GraSurveyRepository } from '../core/gra-survey.repository';
import { GraConfigRepository } from '../core/gra-config.repository';
import { GraValidation } from '../core/gra.validation';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { i18nText } from 'src/shared/types/i18n';
import { graValidationStrings } from '../config/strings/gra.validation';
import {
	SaveGraNotificationDto,
	BulkUploadGraNotificationDto,
	UpdateGraEmailTemplateDto,
	ListStudentsGraDto,
	SendGraEmailDto,
	ResendGraNotificationDto,
	GetSurveyByTokenDto,
	CompleteGraSurveyDto,
	DashboardGraDto,
	SearchGraStudentsDto,
} from '../model/gra.dtos';
import { resolvePagination, toPaginated } from 'src/commons/pagination.dtos';

/** NestJS HttpExceptions (e.g. MailService's BadGatewayException) carry the real SMTP error in
 *  a `details` field on their response body; `.message` alone is just the localized error key. */
function extractSendErrorMessage(err: unknown): string {
	if (err && typeof err === 'object' && 'getResponse' in err) {
		const response = (err as { getResponse: () => unknown }).getResponse();
		if (response && typeof response === 'object') {
			const { details, message } = response as { details?: unknown; message?: unknown };
			if (typeof details === 'string' && details) return details;
			if (typeof message === 'string') return message;
		} else if (typeof response === 'string') {
			return response;
		}
	}
	return err instanceof Error ? err.message : String(err);
}

const STUDENT_SEARCH_MAX_RESULTS = 30;
const SEND_CONCURRENCY = 20;
const MAX_SEND_ERROR_DETAILS = 100;
const JOB_STATUS_TTL_MS = 30 * 60 * 1000;

type GraNotificationJobStatus = {
	progressPct: number;
	totalStudents: number;
	emailsSent: number;
	emailsFailed: number;
	errors: string[];
};

@Injectable()
export class GraNotificationService {
	private readonly logger = new Logger(GraNotificationService.name);
	private readonly notificationJobs = new Map<string, GraNotificationJobStatus>();

	constructor(
		private readonly notifRepo: GraNotificationRepository,
		private readonly surveyRepo: GraSurveyRepository,
		private readonly configRepo: GraConfigRepository,
		private readonly configService: ConfigService,
		private readonly mailService: MailService,
		private readonly surveyEmailTemplateService: SurveyEmailTemplateService,
	) {}

	private async getTypeIds() {
		const [graSurveyTypeId, activeStatusId, closedStatusId, scheduledStatusId, sentStatusId] =
			await Promise.all([
				this.surveyRepo.getGraSurveyTypeId(),
				this.surveyRepo.getActiveSurveyStatusId(),
				this.surveyRepo.getClosedSurveyStatusId(),
				this.surveyRepo.getScheduledNotificationStatusId(),
				this.surveyRepo.getSentNotificationStatusId(),
			]);

		const missing: string[] = [];
		if (!graSurveyTypeId) missing.push(TYPE_CODES.SURVEY_TYPE.GRA);
		if (!activeStatusId) missing.push(TYPE_CODES.SURVEY_STATUS.ACTIVE);
		if (!closedStatusId) missing.push(TYPE_CODES.SURVEY_STATUS.CLOSED);
		if (!scheduledStatusId) missing.push(TYPE_CODES.SURVEY_NOTIFICATION_STATUS.SCHEDULED);
		if (!sentStatusId) missing.push(TYPE_CODES.SURVEY_NOTIFICATION_STATUS.SENT);

		if (missing.length) {
			this.logger.error(`Missing type seeds: ${missing.join(', ')}`);
			throw new InternalServerErrorException(graValidationStrings.error.seedMissing);
		}

		return {
			graSurveyTypeId: graSurveyTypeId!,
			activeStatusId: activeStatusId!,
			closedStatusId: closedStatusId!,
			scheduledStatusId: scheduledStatusId!,
			sentStatusId: sentStatusId!,
		};
	}

	async saveNotification(dto: SaveGraNotificationDto, academicPeriodId: number) {
		GraValidation.validateProgram(dto.programId);

		const { graSurveyTypeId, activeStatusId, scheduledStatusId } = await this.getTypeIds();

		let survey = await this.surveyRepo.findExistingGraSurvey(
			graSurveyTypeId,
			dto.studentId,
			academicPeriodId,
			dto.programId,
		);

		if (!survey) {
			const courseSectionId = await this.resolveDefaultCourseSectionId();
			// Use || (not ??) so a falsy campusId (e.g. 0 sent by the client when none was picked)
			// still falls back to resolving the student's default campus instead of failing.
			const campusId = dto.campusId || (await this.surveyRepo.resolveDefaultCampus(dto.studentId));
			if (!campusId) {
				throw new InternalServerErrorException(graValidationStrings.error.defaultCampusMissing);
			}
			survey = (await this.surveyRepo.create({
				surveyTypeId: graSurveyTypeId,
				surveyStatusTypeId: activeStatusId,
				studentId: dto.studentId,
				academicPeriodId,
				campusId,
				programId: dto.programId,
				...(courseSectionId !== null && { courseSectionId }),
			})) as SurveyEntity;
		}

		const resolvedSurvey = survey;

		const alreadyNotified = await this.notifRepo.existsForStudent(resolvedSurvey.id);
		if (alreadyNotified) {
			throw new BadRequestException(graValidationStrings.error.studentAlreadyNotified);
		}

		const token = uuidv4();

		const notification = await this.notifRepo.create({
			surveyId: resolvedSurvey.id,
			notificationStatusTypeId: scheduledStatusId,
			token,
			maxRegisterDate: dto.maxRegisterDate,
		});

		return {
			notificationId: notification.id,
			surveyId: resolvedSurvey.id,
			studentId: dto.studentId,
			token,
			message: graValidationStrings.success.notificationCreated,
		};
	}

	/** Excel template for GRA bulk upload: a single "Codigo Alumno" column. */
	async generateNotificationTemplate(): Promise<{ buffer: Buffer; fileName: string }> {
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Plantilla');
		sheet.addRow(['Codigo Alumno']);
		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		return { buffer, fileName: 'plantilla_gra_notificaciones.xlsx' };
	}

	/** Bulk version of saveNotification: adds every student code in the Excel to the GRA list. */
	async bulkUploadNotifications(dto: BulkUploadGraNotificationDto, academicPeriodId: number) {
		GraValidation.validateProgram(dto.programId);

		const { graSurveyTypeId, activeStatusId, scheduledStatusId } = await this.getTypeIds();

		const workbook = new ExcelJS.Workbook();
		try {
			const buffer = Buffer.from(dto.fileBase64, 'base64');
			await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
		} catch {
			throw new BadRequestException(graValidationStrings.error.invalidExcelFile);
		}

		const worksheet = workbook.worksheets[0];
		if (!worksheet) throw new BadRequestException(graValidationStrings.error.excelNoSheets);

		const rows = sheetToObjects(worksheet);
		if (rows.length === 0) throw new BadRequestException(graValidationStrings.error.excelEmpty);

		const courseSectionId = await this.resolveDefaultCourseSectionId();

		// Resolve every student code up front in a single query to avoid an N+1 lookup per row.
		const codeByRow = rows.map((row) =>
			normalizeCellText(
				row['Codigo Alumno'] ?? row['Código Alumno'] ?? row['CODIGO_ALUMNO'] ?? row['student_code'],
			),
		);
		const uniqueCodes = [...new Set(codeByRow.filter((code) => code !== ''))];
		const students = await this.surveyRepo.findStudentsByCodes(uniqueCodes);
		const studentIdByCode = new Map(students.map((s) => [s.code, s.id]));

		const results = {
			total: rows.length,
			success: 0,
			failed: 0,
			errors: [] as { row: number; reason: string }[],
		};

		// Per-row reporting (total/success/failed/errors) is the contract, so each row commits
		// independently — we deliberately do NOT wrap the loop in a single transaction, which
		// would roll back every previously-succeeded row on the first failure.
		for (let i = 0; i < rows.length; i++) {
			const rowNum = i + 2; // +2: row 1 is the header
			const studentCode = codeByRow[i];

			if (!studentCode) {
				results.failed++;
				results.errors.push({ row: rowNum, reason: graValidationStrings.error.emptyStudentCode });
				continue;
			}

			const studentId = studentIdByCode.get(studentCode);
			if (!studentId) {
				results.failed++;
				results.errors.push({ row: rowNum, reason: graValidationStrings.error.studentNotFound });
				continue;
			}

			let survey = await this.surveyRepo.findExistingGraSurvey(
				graSurveyTypeId,
				studentId,
				academicPeriodId,
				dto.programId,
			);
			if (!survey) {
				const campusId = dto.campusId || (await this.surveyRepo.resolveDefaultCampus(studentId));
				if (!campusId) {
					results.failed++;
					results.errors.push({
						row: rowNum,
						reason: graValidationStrings.error.defaultCampusMissing,
					});
					continue;
				}
				survey = (await this.surveyRepo.create({
					surveyTypeId: graSurveyTypeId,
					surveyStatusTypeId: activeStatusId,
					studentId,
					academicPeriodId,
					campusId,
					programId: dto.programId,
					...(courseSectionId !== null && { courseSectionId }),
				})) as SurveyEntity;
			}

			if (await this.notifRepo.existsForStudent(survey.id)) {
				results.failed++;
				results.errors.push({ row: rowNum, reason: graValidationStrings.error.alreadyInList });
				continue;
			}

			await this.notifRepo.create({
				surveyId: survey.id,
				notificationStatusTypeId: scheduledStatusId,
				token: uuidv4(),
				maxRegisterDate: dto.maxRegisterDate,
			});
			results.success++;
		}

		return results;
	}

	/** Returns the first available course section, or null when none exist. GRA surveys don't
	 *  require a specific course section, so null is acceptable. */
	private async resolveDefaultCourseSectionId(): Promise<number | null> {
		return this.surveyRepo.getDefaultCourseSectionId();
	}

	async listStudents(dto: ListStudentsGraDto, academicPeriodId?: number | null) {
		const { graSurveyTypeId, closedStatusId } = await this.getTypeIds();
		const { page, pageSize, skip, take } = resolvePagination(dto);
		const { rows, total } = await this.notifRepo.listStudentsGra(graSurveyTypeId, closedStatusId, {
			academicPeriodId: academicPeriodId ?? undefined,
			programId: dto.programId,
			campusId: dto.campusId,
			studentCode: dto.studentCode,
			search: dto.search,
			skip,
			take,
		});
		return toPaginated(rows, total, page, pageSize);
	}

	/** Search active students by code or name, for the "add individual student" search box. */
	async searchStudents(dto: SearchGraStudentsDto) {
		const term = dto.term.trim();
		if (!term) return [];

		const rows = await this.surveyRepo.searchStudentsByCodeOrName(term, STUDENT_SEARCH_MAX_RESULTS);

		return rows.map((row) => ({
			studentId: row.id,
			code: row.code,
			name: `${row.firstName} ${row.lastName}`.trim(),
			email: row.email ?? '',
			// The student's own program: the add-to-notification flow uses it so adding never
			// depends on (nor is overridden by) the career filter selected in the UI.
			programId: row.programId ?? null,
			career: row.programName ?? '',
		}));
	}

	async deleteNotification(id: number) {
		const notif = await this.notifRepo.findOneById(id);
		if (!notif)
			throw new NotFoundException(graValidationStrings.error.notificationNotFound, {
				description: String(id),
			});
		await this.notifRepo.remove(id);
		return { deleted: true, notificationId: id };
	}

	/** Resends the GRA survey email to a single already-notified student, regardless of its
	 *  send status (pending or already sent) — but refuses once the student has responded,
	 *  since re-sending a completed survey's link makes no sense. */
	async resendNotification(notificationId: number, dto: ResendGraNotificationDto) {
		const details = await this.notifRepo.findNotificationDetailsById(notificationId);
		if (!details) {
			throw new NotFoundException(graValidationStrings.error.notificationNotFound, {
				description: String(notificationId),
			});
		}

		const { sentStatusId, closedStatusId } = await this.getTypeIds();

		if (details.surveyStatusTypeId === closedStatusId) {
			throw new BadRequestException(graValidationStrings.error.alreadyResponded);
		}

		const emailTemplate = await this.surveyEmailTemplateService.getEmailTemplate(
			TYPE_CODES.SURVEY_TYPE.GRA,
			dto.lang ?? 'es',
		);

		const surveyBaseUrl =
			dto.surveyBaseUrl ||
			this.configService.get<string>('SURVEY_BASE_URL') ||
			'http://localhost:3001';
		const surveyUrl = `${surveyBaseUrl}${SURVEY_FRONTEND_PATHS.GRA}?token=${details.token}`;

		const emailBody = this.surveyEmailTemplateService.replacePlaceholders(emailTemplate.body, {
			student_name: details.studentName,
			student_code: details.studentCode,
			program_name: details.programName,
			survey_link: surveyUrl,
			token: details.token,
		});

		try {
			await this.mailService.sendRawEmail({
				to: details.studentEmail,
				subject: emailTemplate.subject,
				html: emailBody,
			});
		} catch (err) {
			throw new BadRequestException(extractSendErrorMessage(err));
		}

		await this.notifRepo.markAsSent(notificationId, sentStatusId);

		return { success: true, notificationId };
	}

	/** Preview of what a send would do: how many careers and students would be notified.
	 *  When dto.resend is set ("Reenviar a quienes ya recibieron"), also counts already-notified
	 *  students who haven't responded yet — students who already completed the survey are
	 *  never included, regardless of the flag. */
	async getSendSummary(dto: SendGraEmailDto, academicPeriodId: number) {
		const { graSurveyTypeId, scheduledStatusId, closedStatusId } = await this.getTypeIds();

		const byProgram = await this.notifRepo.findSendSummaryByProgram(
			graSurveyTypeId,
			{ scheduledStatusId, closedStatusId },
			{ academicPeriodId, programId: dto.programId, includeAlreadySent: dto.resend ?? false },
		);

		return {
			totalPrograms: byProgram.length,
			totalStudents: byProgram.reduce((sum, row) => sum + row.studentCount, 0),
			byProgram,
		};
	}

	/** Kicks off email sending in the background and returns a job id to poll for progress. */
	async startSendEmails(dto: SendGraEmailDto, academicPeriodId: number) {
		const { graSurveyTypeId, scheduledStatusId, closedStatusId } = await this.getTypeIds();

		const pending = await this.notifRepo.findSendCandidates(
			graSurveyTypeId,
			{ scheduledStatusId, closedStatusId },
			{ academicPeriodId, programId: dto.programId, includeAlreadySent: dto.resend ?? false },
		);

		return this.startJob(dto, pending);
	}

	/** Shared job bookkeeping for the send flow (with or without the resend toggle) — both just
	 *  feed a list of candidate notifications through the same background sender. */
	private startJob(
		dto: SendGraEmailDto,
		pending: Awaited<ReturnType<GraNotificationRepository['findSendCandidates']>>,
	) {
		GraValidation.validateSendEmailRequest(pending.length);

		const jobId = randomUUID();
		this.notificationJobs.set(jobId, {
			progressPct: 0,
			totalStudents: pending.length,
			emailsSent: 0,
			emailsFailed: 0,
			errors: [],
		});
		const kind = dto.resend ? 'resend' : 'send';
		this.logger.log(
			`GRA notification ${kind} job ${jobId} queued: totalStudents=${pending.length}`,
		);

		void this.processSendEmails(dto, pending, jobId)
			.then((result) => {
				this.logger.log(
					`GRA notification ${kind} job ${jobId} completed: sent=${result.sent}, failed=${result.failed}` +
						(result.errors.length ? `, errors=${JSON.stringify(result.errors)}` : ''),
				);
			})
			.catch((err) => {
				this.logger.error(
					`GRA notification ${kind} job ${jobId} failed: ${(err as Error).message}`,
					(err as Error).stack,
				);
			})
			.finally(() => {
				setTimeout(() => this.notificationJobs.delete(jobId), JOB_STATUS_TTL_MS);
			});

		return { accepted: true, jobId };
	}

	getSendStatus(jobId: string) {
		const status = this.notificationJobs.get(jobId);
		if (!status) {
			throw new NotFoundException(graValidationStrings.error.notificationJobNotFound);
		}
		return status;
	}

	private async processSendEmails(
		dto: SendGraEmailDto,
		pending: Awaited<ReturnType<GraNotificationRepository['findSendCandidates']>>,
		jobId: string,
	) {
		const { sentStatusId } = await this.getTypeIds();

		const emailTemplate = await this.surveyEmailTemplateService.getEmailTemplate(
			TYPE_CODES.SURVEY_TYPE.GRA,
			dto.lang ?? 'es',
		);

		const surveyBaseUrl =
			dto.surveyBaseUrl ||
			this.configService.get<string>('SURVEY_BASE_URL') ||
			'http://localhost:3001';

		const total = pending.length;
		let sent = 0;
		let failed = 0;
		const errors: string[] = [];

		await this.processConcurrently(pending, SEND_CONCURRENCY, async (student) => {
			try {
				const surveyUrl = `${surveyBaseUrl}${SURVEY_FRONTEND_PATHS.GRA}?token=${student.token}`;

				const emailBody = this.surveyEmailTemplateService.replacePlaceholders(emailTemplate.body, {
					student_name: student.studentName,
					student_code: student.studentCode,
					program_name: student.programName,
					survey_link: surveyUrl,
					token: student.token,
				});

				await this.mailService.sendRawEmail({
					to: student.studentEmail,
					subject: emailTemplate.subject,
					html: emailBody,
				});

				await this.notifRepo.markAsSent(student.notificationId, sentStatusId);
				sent++;
			} catch (err) {
				failed++;
				if (errors.length < MAX_SEND_ERROR_DETAILS) {
					errors.push(`Student ${student.studentCode}: ${extractSendErrorMessage(err)}`);
				}
			} finally {
				this.notificationJobs.set(jobId, {
					progressPct: Math.round(((sent + failed) / total) * 100),
					totalStudents: total,
					emailsSent: sent,
					emailsFailed: failed,
					errors: [...errors],
				});
			}
		});

		return { total, sent, failed, errors };
	}

	private async processConcurrently<T>(
		items: T[],
		concurrency: number,
		handler: (item: T) => Promise<void>,
	) {
		let nextIndex = 0;
		const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
			while (nextIndex < items.length) {
				const item = items[nextIndex];
				nextIndex++;
				await handler(item);
			}
		});
		await Promise.all(workers);
	}

	/** Reads the GRA email template (email_templates row keyed by the GRA survey type code). */
	async getEmailTemplateConfig() {
		const template = await this.notifRepo.findEmailTemplateByCode(TYPE_CODES.SURVEY_TYPE.GRA);
		if (!template) {
			throw new NotFoundException(graValidationStrings.error.emailTemplateMissing);
		}
		return template;
	}

	/** Upserts the GRA email template content (subject/body, i18n). GRA-specific by design. */
	async updateEmailTemplateConfig(dto: UpdateGraEmailTemplateDto) {
		const name = JSON.stringify({ es: 'Encuesta de Graduandos', en: 'Graduate Survey' });
		const subject = JSON.stringify({ es: dto.subjectEs, en: dto.subjectEn ?? dto.subjectEs });
		const body = JSON.stringify({ es: dto.bodyEs, en: dto.bodyEn ?? dto.bodyEs });

		const template = await this.notifRepo.upsertEmailTemplate({
			code: TYPE_CODES.SURVEY_TYPE.GRA,
			categoryCode: TYPE_CODES.EMAIL_TEMPLATE_CATEGORY.SURVEY,
			name,
			subject,
			body,
		});
		if (!template) {
			throw new BadRequestException(graValidationStrings.error.emailTemplateCategoryMissing);
		}
		return template;
	}

	async validateToken(token: string) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(token);
		GraValidation.validateToken(tokenData);

		return {
			valid: true,
			surveyId: tokenData.surveyId,
			studentId: tokenData.studentId,
			studentName: tokenData.studentName,
			studentCode: tokenData.studentCode,
			programId: tokenData.programId,
			programName: tokenData.programName,
			academicPeriodId: tokenData.academicPeriodId,
			maxRegisterDate: tokenData.maxRegisterDate,
		};
	}

	async getSurveyByToken(dto: GetSurveyByTokenDto) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(dto.token);
		GraValidation.validateToken(tokenData);

		const configs = await this.configRepo.findAllGra({
			programId: tokenData.programId,
			isActive: true,
			isVisible: true,
		});

		const language = dto.language ?? 'es';

		const outcomes = configs.map((cfg) => {
			const extra = (cfg.extra as Record<string, any>) ?? {};
			return {
				outcomeConfigId: cfg.id,
				outcomeId: cfg.outcomeId,
				name: language === 'en' && extra.nameEn ? extra.nameEn : cfg.userOutcomeName,
				description:
					language === 'en' && extra.descriptionEn
						? extra.descriptionEn
						: (cfg.userOutcomeDescription ?? null),
				order: extra.order ?? null,
			};
		});

		return {
			surveyId: tokenData.surveyId,
			studentId: tokenData.studentId,
			studentName: tokenData.studentName,
			programId: tokenData.programId,
			outcomes,
		};
	}

	async completeSurvey(dto: CompleteGraSurveyDto) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(dto.token);
		GraValidation.validateToken(tokenData);
		GraValidation.validateCompleteScores(dto.scores);

		const { closedStatusId } = await this.getTypeIds();
		const surveyId = tokenData.surveyId;

		try {
			const scoreItems = dto.scores.map((item) => ({
				outcomeConfigId: item.outcomeConfigId,
				score: item.score,
				commentaries: i18nText(item.commentaries),
			}));
			await this.notifRepo.saveScoresAndCloseSurvey(
				surveyId,
				closedStatusId,
				scoreItems,
				dto.commentaries,
			);

			return {
				success: true,
				surveyId,
				scoresSaved: dto.scores.length,
				message: graValidationStrings.success.completed,
			};
		} catch (err) {
			throw new BadRequestException(graValidationStrings.error.completeFailed, {
				description: (err as Error).message,
			});
		}
	}

	async getDashboard(dto: DashboardGraDto, academicPeriodId?: number | null) {
		const { graSurveyTypeId, activeStatusId, closedStatusId } = await this.getTypeIds();

		const data = await this.surveyRepo.getDashboardData(
			graSurveyTypeId,
			activeStatusId,
			closedStatusId,
			{
				academicPeriodId: academicPeriodId ?? undefined,
				programId: dto.programId,
				campusId: dto.campusId,
			},
		);

		const completionRate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

		return {
			summary: {
				completed: data.completed,
				pending: data.pending,
				total: data.total,
				completionRatePct: completionRate,
			},
			byProgram: data.byProgram,
			filters: { ...dto, academicPeriodId: academicPeriodId ?? null },
		};
	}

	/** Builds an Excel workbook of the completed GRA surveys for a period/program. */
	async exportSurveys(
		academicPeriodId: number,
		programId?: number,
	): Promise<{ buffer: Buffer; fileName: string }> {
		const rows = await this.surveyRepo.getCompletedSurveysForExport(academicPeriodId, programId);

		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Encuestas GRA');
		sheet.columns = [
			{ header: 'Código alumno', key: 'studentCode', width: 16 },
			{ header: 'Alumno', key: 'studentName', width: 32 },
			{ header: 'Carrera', key: 'programName', width: 30 },
			{ header: 'Outcome', key: 'outcomeCode', width: 14 },
			{ header: 'Descripción outcome', key: 'outcomeName', width: 40 },
			{ header: 'Puntaje', key: 'score', width: 10 },
			{ header: 'Comentario', key: 'commentaries', width: 40 },
			{ header: 'Fecha', key: 'completedAt', width: 22 },
		];
		sheet.getRow(1).font = { bold: true };

		for (const r of rows) {
			const comment =
				r.commentaries && typeof r.commentaries === 'object'
					? ((r.commentaries as Record<string, unknown>).commentaries ?? '')
					: (r.commentaries ?? '');
			sheet.addRow({
				studentCode: r.studentCode,
				studentName: r.studentName,
				programName: r.programName,
				outcomeCode: r.outcomeCode,
				outcomeName: r.outcomeName,
				score: r.score,
				commentaries: String(comment ?? ''),
				completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : '',
			});
		}

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		const fileName = programId
			? `encuestas_gra_${programId}_${academicPeriodId}.xlsx`
			: `encuestas_gra_${academicPeriodId}.xlsx`;
		return { buffer, fileName };
	}
}
