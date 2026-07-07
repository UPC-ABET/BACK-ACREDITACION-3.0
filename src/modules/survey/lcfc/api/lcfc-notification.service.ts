import {
	Injectable,
	BadRequestException,
	Logger,
	InternalServerErrorException,
	NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as ExcelJS from 'exceljs';
import { MailService } from 'src/modules/mail/mail.service';
import { SurveyEmailTemplateService } from 'src/modules/survey/shared/survey-email.service';
import { SURVEY_FRONTEND_PATHS } from 'src/modules/survey/shared/survey-frontend-paths';
import {
	LcfcNotificationRepository,
	LcfcSendCandidate,
} from '../core/lcfc-notification.repository';
import { LcfcSurveyRepository } from '../core/lcfc-survey.repository';
import { LcfcConfigRepository } from '../core/lcfc-config.repository';
import { LcfcValidation } from '../core/lcfc.validation';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { lcfcValidationStrings } from '../config/strings/lcfc.validation';
import { i18nText } from 'src/shared/types/i18n';
import {
	SendLcfcNotificationDto,
	GetLcfcSurveyByTokenDto,
	CompleteLcfcSurveyDto,
	DashboardLcfcDto,
} from '../model/lcfc.dtos';

const NOTIFICATION_BATCH_SIZE = 1000;
const MAX_SEND_ERROR_DETAILS = 100;
const JOB_STATUS_TTL_MS = 30 * 60 * 1000;

type LcfcNotificationJobStatus = {
	progressPct: number;
	emailsSent: number;
	emailsFailed: number;
};

@Injectable()
export class LcfcNotificationService {
	private readonly logger = new Logger(LcfcNotificationService.name);
	private readonly notificationJobs = new Map<string, LcfcNotificationJobStatus>();

	constructor(
		private readonly notifRepo: LcfcNotificationRepository,
		private readonly surveyRepo: LcfcSurveyRepository,
		private readonly configRepo: LcfcConfigRepository,
		private readonly configService: ConfigService,
		private readonly mailService: MailService,
		private readonly surveyEmailTemplateService: SurveyEmailTemplateService,
	) {}

	startSendNotifications(dto: SendLcfcNotificationDto, academicPeriodId: number) {
		const jobId = randomUUID();
		this.notificationJobs.set(jobId, {
			progressPct: 0,
			emailsSent: 0,
			emailsFailed: 0,
		});
		this.logger.log(
			`LCFC notification job ${jobId} queued for academicPeriodId=${academicPeriodId}`,
		);

		void this.sendNotifications({ ...dto }, academicPeriodId, jobId)
			.then((result) => {
				this.logger.log(
					`LCFC notification job ${jobId} completed: totalStudents=${result.totalStudents}, surveysCreated=${result.surveysCreated}, alreadyExisted=${result.alreadyExisted}, emailsSent=${result.emailsSent}, emailsFailed=${result.emailsFailed}`,
				);
			})
			.catch((err) => {
				this.logger.error(
					`LCFC notification job ${jobId} failed: ${(err as Error).message}`,
					(err as Error).stack,
				);
			})
			.finally(() => {
				setTimeout(() => this.notificationJobs.delete(jobId), JOB_STATUS_TTL_MS);
			});

		return { accepted: true, jobId };
	}

	getSendNotificationStatus(jobId: string) {
		const status = this.notificationJobs.get(jobId);
		if (!status) {
			throw new NotFoundException(lcfcValidationStrings.error.notificationJobNotFound);
		}
		return status;
	}

	private async getTypeIds() {
		const [lcfcSurveyTypeId, activeStatusId, closedStatusId, scheduledStatusId, sentStatusId] =
			await Promise.all([
				this.surveyRepo.getLcfcSurveyTypeId(),
				this.surveyRepo.getActiveSurveyStatusId(),
				this.surveyRepo.getClosedSurveyStatusId(),
				this.surveyRepo.getScheduledNotificationStatusId(),
				this.surveyRepo.getSentNotificationStatusId(),
			]);

		const missing: string[] = [];
		if (!lcfcSurveyTypeId) missing.push(TYPE_CODES.SURVEY_TYPE.LCFC);
		if (!activeStatusId) missing.push(TYPE_CODES.SURVEY_STATUS.ACTIVE);
		if (!closedStatusId) missing.push(TYPE_CODES.SURVEY_STATUS.CLOSED);
		if (!scheduledStatusId) missing.push(TYPE_CODES.SURVEY_NOTIFICATION_STATUS.SCHEDULED);
		if (!sentStatusId) missing.push(TYPE_CODES.SURVEY_NOTIFICATION_STATUS.SENT);

		if (missing.length) {
			this.logger.error(`Missing type seeds: ${missing.join(', ')}`);
			throw new InternalServerErrorException(lcfcValidationStrings.error.seedMissing);
		}

		return {
			lcfcSurveyTypeId: lcfcSurveyTypeId!,
			activeStatusId: activeStatusId!,
			closedStatusId: closedStatusId!,
			scheduledStatusId: scheduledStatusId!,
			sentStatusId: sentStatusId!,
		};
	}

	async sendNotifications(dto: SendLcfcNotificationDto, academicPeriodId: number, jobId?: string) {
		const { lcfcSurveyTypeId, activeStatusId, closedStatusId, scheduledStatusId, sentStatusId } =
			await this.getTypeIds();
		const activeConfigs = await this.configRepo.findAllLcfc({
			academicPeriodId,
			programId: dto.programId,
			isActive: true,
		});

		if (activeConfigs.length === 0) {
			throw new BadRequestException(lcfcValidationStrings.error.noActiveCourses);
		}
		let courseSectionIds = activeConfigs
			.map((c) => c.extra?.courseSectionId)
			.filter((id): id is number => typeof id === 'number');

		if (dto.campusId) {
			const campusId = dto.campusId;
			courseSectionIds = courseSectionIds.filter((id) => {
				const cfg = activeConfigs.find((c) => c.extra?.courseSectionId === id);
				return cfg?.extra?.campusId === campusId;
			});
		}

		if (dto.courseSectionId) {
			const csId = dto.courseSectionId;
			courseSectionIds = courseSectionIds.filter((id) => id === csId);
		}

		if (courseSectionIds.length === 0) {
			throw new BadRequestException(lcfcValidationStrings.error.noMatchingSections);
		}
		const totalStudents = await this.notifRepo.countEnrolledStudentsByCourses(courseSectionIds);

		if (totalStudents === 0) {
			throw new BadRequestException(lcfcValidationStrings.error.noEnrolledStudents);
		}
		this.updateSendNotificationStatus(jobId, {
			progressPct: 0,
			emailsSent: 0,
			emailsFailed: 0,
		});
		this.logger.log(
			`LCFC notification job ${jobId ?? 'sync'} started: totalStudents=${totalStudents}, batchSize=${NOTIFICATION_BATCH_SIZE}`,
		);
		// Deadline is configured in the Configuration tab; fall back to it when the send
		// request doesn't carry one of its own.
		const maxRegisterDate =
			dto.maxRegisterDate ??
			(await this.configRepo.getDeadline(dto.programId ?? null, academicPeriodId));

		const surveyBaseUrl =
			dto.surveyBaseUrl ||
			this.configService.get<string>('SURVEY_BASE_URL') ||
			'http://localhost:3001';
		const emailTemplate = await this.surveyEmailTemplateService.getEmailTemplate(
			TYPE_CODES.SURVEY_TYPE.LCFC,
			dto.lang ?? 'es',
		);

		let emailsSent = 0;
		let emailsFailed = 0;
		const errors: string[] = [];
		let surveysCreated = 0;
		let alreadyExisted = 0;
		const configByCourseSectionId = new Map(
			activeConfigs
				.map((config) => ({ config, courseSectionId: config.extra?.courseSectionId }))
				.filter(
					(item): item is { config: (typeof activeConfigs)[number]; courseSectionId: number } =>
						typeof item.courseSectionId === 'number',
				)
				.map((item) => [item.courseSectionId, item.config]),
		);

		for (let offset = 0; offset < totalStudents; offset += NOTIFICATION_BATCH_SIZE) {
			const batchNumber = Math.floor(offset / NOTIFICATION_BATCH_SIZE) + 1;
			const totalBatches = Math.ceil(totalStudents / NOTIFICATION_BATCH_SIZE);
			const enrolledStudents = await this.notifRepo.getEnrolledStudentsByCourses(
				courseSectionIds,
				NOTIFICATION_BATCH_SIZE,
				offset,
			);
			this.logger.log(
				`LCFC notification job ${jobId ?? 'sync'} batch ${batchNumber}/${totalBatches} loaded: students=${enrolledStudents.length}, offset=${offset}`,
			);
			const candidates: LcfcSendCandidate[] = enrolledStudents.map((student) => {
				const config = configByCourseSectionId.get(student.courseSectionId);
				return {
					studentId: student.studentId,
					studentName: student.studentName,
					studentCode: student.studentCode,
					studentEmail: student.studentEmail,
					courseSectionId: student.courseSectionId,
					courseName: student.courseName,
					programName: student.programName,
					programId: student.programId ?? dto.programId ?? config?.extra?.programId ?? null,
					campusId: dto.campusId ?? student.campusId ?? config?.extra?.campusId ?? null,
				};
			});

			const batchResult = await this.notifRepo
				.processSendNotifications({
					lcfcSurveyTypeId,
					activeStatusId,
					closedStatusId,
					scheduledStatusId,
					resend: dto.resend ?? false,
					academicPeriodId,
					maxRegisterDate,
					candidates,
				})
				.catch((err) => {
					throw new BadRequestException(lcfcValidationStrings.error.processFailed, {
						description: (err as Error).message,
					});
				});

			surveysCreated += batchResult.surveysCreated;
			alreadyExisted += batchResult.alreadyExisted;
			this.logger.log(
				`LCFC notification job ${jobId ?? 'sync'} batch ${batchNumber}/${totalBatches} prepared: surveysCreated=${batchResult.surveysCreated}, alreadyExisted=${batchResult.alreadyExisted}, pendingEmails=${batchResult.pendingNotifications.length}`,
			);

			let batchEmailsSent = 0;
			let batchEmailsFailed = 0;
			await Promise.all(
				batchResult.pendingNotifications.map(async (notif) => {
					try {
						const surveyUrl = `${surveyBaseUrl}${SURVEY_FRONTEND_PATHS.LCFC}?token=${notif.token}`;
						const emailBody = this.surveyEmailTemplateService.replacePlaceholders(
							emailTemplate.body,
							{
								student_name: notif.studentName,
								student_code: notif.studentCode,
								course_name: notif.courseName,
								program_name: notif.programName,
								survey_link: surveyUrl,
								token: notif.token,
							},
						);

						await this.mailService.sendRawEmail({
							to: notif.studentEmail,
							subject: emailTemplate.subject,
							html: emailBody,
						});

						await this.notifRepo.markAsSentBySurveyId(notif.surveyId, sentStatusId);
						emailsSent++;
						batchEmailsSent++;
					} catch (err) {
						emailsFailed++;
						batchEmailsFailed++;
						if (errors.length < MAX_SEND_ERROR_DETAILS) {
							errors.push(`Student ${notif.studentCode}: ${(err as Error).message}`);
						}
					} finally {
						this.updateSendNotificationStatus(jobId, {
							emailsSent,
							emailsFailed,
						});
					}
				}),
			);
			this.updateSendNotificationStatus(jobId, {
				progressPct: Math.round(((offset + enrolledStudents.length) / totalStudents) * 100),
				emailsSent,
				emailsFailed,
			});
			this.logger.log(
				`LCFC notification job ${jobId ?? 'sync'} batch ${batchNumber}/${totalBatches} emails processed: sent=${batchEmailsSent}, failed=${batchEmailsFailed}, totalSent=${emailsSent}, totalFailed=${emailsFailed}`,
			);
		}

		return {
			totalStudents,
			surveysCreated,
			alreadyExisted,
			emailsSent,
			emailsFailed,
			errors,
		};
	}

	private updateSendNotificationStatus(
		jobId: string | undefined,
		patch: Partial<LcfcNotificationJobStatus>,
	) {
		if (!jobId) return;
		const current = this.notificationJobs.get(jobId);
		if (!current) return;
		this.notificationJobs.set(jobId, { ...current, ...patch });
	}

	async validateToken(token: string) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(token);
		LcfcValidation.validateToken(tokenData);

		return {
			valid: true,
			surveyId: tokenData.surveyId,
			studentId: tokenData.studentId,
			studentName: tokenData.studentName,
			studentCode: tokenData.studentCode,
			programId: tokenData.programId,
			programName: tokenData.programName,
			academicPeriodId: tokenData.academicPeriodId,
			period: tokenData.period,
			courseName: tokenData.courseName,
			courseSectionId: tokenData.courseSectionId,
			maxRegisterDate: tokenData.maxRegisterDate,
		};
	}

	/** Builds an Excel workbook of the completed LCFC surveys for a period/program. */
	async exportSurveys(
		academicPeriodId: number,
		programId?: number,
	): Promise<{ buffer: Buffer; fileName: string }> {
		const rows = await this.surveyRepo.getCompletedSurveysForExport(academicPeriodId, programId);

		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Encuestas LCFC');
		sheet.columns = [
			{ header: 'Código alumno', key: 'studentCode', width: 16 },
			{ header: 'Alumno', key: 'studentName', width: 32 },
			{ header: 'Carrera', key: 'programName', width: 30 },
			{ header: 'Curso', key: 'courseName', width: 32 },
			{ header: 'Sección', key: 'sectionCode', width: 12 },
			{ header: 'Outcome', key: 'outcomeCode', width: 14 },
			{ header: 'Descripción outcome', key: 'outcomeName', width: 40 },
			{ header: 'Puntaje', key: 'score', width: 10 },
			{ header: 'Comentario', key: 'generalComment', width: 50 },
			{ header: 'Fecha', key: 'completedAt', width: 22 },
		];
		sheet.getRow(1).font = { bold: true };

		for (const r of rows) {
			sheet.addRow({
				studentCode: r.studentCode,
				studentName: r.studentName,
				programName: r.programName,
				courseName: r.courseName,
				sectionCode: r.sectionCode,
				outcomeCode: r.outcomeCode,
				outcomeName: r.outcomeName,
				score: r.score,
				generalComment: r.generalComment ?? '',
				completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : '',
			});
		}

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		const fileName = programId
			? `encuestas_lcfc_${programId}_${academicPeriodId}.xlsx`
			: `encuestas_lcfc_${academicPeriodId}.xlsx`;
		return { buffer, fileName };
	}

	async getStudentSurveys(token: string) {
		const data = await this.notifRepo.getStudentSurveysByToken(token);
		if (!data) {
			throw new BadRequestException(lcfcValidationStrings.error.tokenNotFound);
		}
		return data;
	}

	async getSurveyByToken(dto: GetLcfcSurveyByTokenDto) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(dto.token);
		LcfcValidation.validateToken(tokenData);

		// Look up the commission configured for this section so the survey only shows
		// outcomes of that commission, filtered by the student's own program.
		const config = await this.configRepo.findByCourseSection(
			tokenData.courseSectionId,
			tokenData.academicPeriodId,
		);
		// The entity's JSONB transformer camelizes keys on load, so stored `commission_id` reads as `commissionId`.
		const commissionId =
			((config?.extra as Record<string, unknown>)?.commissionId as number | null) ?? null;

		let outcomes = await this.surveyRepo.getOutcomesForCourseSection(
			tokenData.courseSectionId,
			tokenData.programId,
			commissionId,
		);
		// Commissions are program-specific, but a section stores a single commission in its
		// config even when it enrols students from several programs. If the stored commission
		// doesn't belong to the student's program the combined filter yields no outcomes and
		// the survey would render empty — retry with the student's program only.
		if (outcomes.length === 0 && commissionId != null) {
			this.logger.warn(
				`LCFC config commission ${commissionId} yields no outcomes for section ${tokenData.courseSectionId} / program ${tokenData.programId}; falling back to program-only filter`,
			);
			outcomes = await this.surveyRepo.getOutcomesForCourseSection(
				tokenData.courseSectionId,
				tokenData.programId,
				null,
			);
		}
		const language = dto.language ?? 'es';

		// Return outcomes grouped by commission so the survey form can render each
		// commission as a labelled section (already expected by the frontend adapter).
		const outcomeList = outcomes.map((o) => ({
			outcomeId: o.outcomeId,
			code: o.code,
			name: o.name,
			description: o.description ?? null,
			commissionId: o.commissionId,
			commissionName: o.commissionName,
		}));

		return {
			surveyId: tokenData.surveyId,
			studentId: tokenData.studentId,
			studentName: tokenData.studentName,
			programId: tokenData.programId,
			courseSectionId: tokenData.courseSectionId,
			language,
			outcomes: outcomeList,
		};
	}

	async completeSurvey(dto: CompleteLcfcSurveyDto) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(dto.token);
		LcfcValidation.validateToken(tokenData);
		LcfcValidation.validateCompleteScores(dto.scores);

		const { closedStatusId } = await this.getTypeIds();
		const surveyId = tokenData.surveyId;

		try {
			const scoreItems = dto.scores.map((item) => ({
				outcomeId: item.outcomeId,
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
				message: lcfcValidationStrings.success.completed,
			};
		} catch (err) {
			throw new BadRequestException(lcfcValidationStrings.error.completeFailed, {
				description: (err as Error).message,
			});
		}
	}

	async getDashboard(dto: DashboardLcfcDto & { academicPeriodId?: number | null }) {
		const { lcfcSurveyTypeId, activeStatusId, closedStatusId } = await this.getTypeIds();

		const data = await this.surveyRepo.getDashboardData(
			lcfcSurveyTypeId,
			activeStatusId,
			closedStatusId,
			{
				academicPeriodId: dto.academicPeriodId ?? undefined,
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
			byCourse: data.byCourse,
			// Per-program breakdown — the frontend only renders it when no program is filtered.
			byProgram: data.byProgram,
			filters: dto,
		};
	}
}
