import {
	Injectable,
	BadRequestException,
	Logger,
	InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from 'src/modules/mail/mail.service';
import { SurveyEmailTemplateService } from 'src/modules/survey/shared/survey-email.service';
import { SURVEY_FRONTEND_PATHS } from 'src/modules/survey/shared/survey-frontend-paths';
import { DataSource } from 'typeorm';
import { LcfcNotificationRepository } from '../core/lcfc-notification.repository';
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

@Injectable()
export class LcfcNotificationService {
	private readonly logger = new Logger(LcfcNotificationService.name);

	constructor(
		private readonly notifRepo: LcfcNotificationRepository,
		private readonly surveyRepo: LcfcSurveyRepository,
		private readonly configRepo: LcfcConfigRepository,
		private readonly dataSource: DataSource,
		private readonly configService: ConfigService,
		private readonly mailService: MailService,
		private readonly surveyEmailTemplateService: SurveyEmailTemplateService,
	) {}

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

	async sendNotifications(dto: SendLcfcNotificationDto) {
		const { lcfcSurveyTypeId, activeStatusId, closedStatusId, scheduledStatusId, sentStatusId } =
			await this.getTypeIds();
		const activeConfigs = await this.configRepo.findAllLcfc({
			academicPeriodId: dto.academicPeriodId,
			programId: dto.programId,
			isActive: true,
		});

		if (activeConfigs.length === 0) {
			throw new BadRequestException(lcfcValidationStrings.error.noActiveCourses);
		}
		let courseSectionIds = activeConfigs
			.map((c) => c.extra?.course_section_id)
			.filter((id): id is number => typeof id === 'number');

		if (dto.campusId) {
			const campusId = dto.campusId;
			courseSectionIds = courseSectionIds.filter((id) => {
				const cfg = activeConfigs.find((c) => c.extra?.course_section_id === id);
				return cfg?.extra?.campus_id === campusId;
			});
		}

		if (dto.courseSectionId) {
			const csId = dto.courseSectionId;
			courseSectionIds = courseSectionIds.filter((id) => id === csId);
		}

		if (courseSectionIds.length === 0) {
			throw new BadRequestException(lcfcValidationStrings.error.noMatchingSections);
		}
		const enrolledStudents = await this.notifRepo.getEnrolledStudentsByCourses(courseSectionIds);

		if (enrolledStudents.length === 0) {
			throw new BadRequestException(lcfcValidationStrings.error.noEnrolledStudents);
		}
		// Deadline is configured in the Configuration tab; fall back to it when the send
		// request doesn't carry one of its own.
		const maxRegisterDate =
			dto.maxRegisterDate ??
			(await this.configRepo.getDeadline(dto.programId ?? null, dto.academicPeriodId));
		let surveysCreated = 0;
		let alreadyExisted = 0;
		const pendingNotifications: {
			studentId: number;
			studentName: string;
			studentCode: string;
			studentEmail: string;
			surveyId: number;
			token: string;
			courseName: string;
			programName: string;
		}[] = [];

		try {
			await this.dataSource.transaction(async (manager) => {
				for (const student of enrolledStudents) {
					const config = activeConfigs.find(
						(c) => c.extra?.course_section_id === student.courseSectionId,
					);
					// Use the STUDENT's own program (a shared course can enrol students from other
					// programs), so the survey shows the student's career and their own outcomes —
					// not the program the config was created for.
					const programId = student.programId ?? dto.programId ?? config?.extra?.program_id ?? null;
					const campusId = dto.campusId ?? student.campusId ?? config?.extra?.campus_id ?? null;

					const existingSurvey = await this.surveyRepo.findExistingLcfcSurvey(
						lcfcSurveyTypeId,
						student.studentId,
						student.courseSectionId,
					);

					if (existingSurvey) {
						alreadyExisted++;
						// Never (re)send to a student who already completed this survey — even on resend.
						// If all of a student's surveys are completed, they receive no email.
						if (existingSurvey.surveyStatusTypeId === closedStatusId) {
							continue;
						}
						// Default behaviour only (re)sends notifications still scheduled (never sent),
						// so pressing "send" twice does not spam students. On resend we reuse the
						// latest existing notification regardless of status and refresh its deadline.
						const existingNotif = dto.resend
							? await manager.query(
									`SELECT id, token FROM survey.notifications WHERE survey_id = $1 ORDER BY id DESC LIMIT 1`,
									[existingSurvey.id],
								)
							: await manager.query(
									`SELECT id, token FROM survey.notifications WHERE survey_id = $1 AND notification_status_type_id = $2 LIMIT 1`,
									[existingSurvey.id, scheduledStatusId],
								);

						if (existingNotif?.[0]) {
							if (dto.resend) {
								// Reset to scheduled and refresh the deadline so the reused token is valid again.
								// sent_date / max_register_date are NOT NULL, so keep the existing deadline
								// when no new one was resolved, and never null out sent_date (it's re-stamped
								// to NOW() by markAsSentBySurveyId once the email goes out).
								await manager.query(
									`UPDATE survey.notifications
									 SET notification_status_type_id = $1,
									     max_register_date = COALESCE($2, max_register_date),
									     updated_at = NOW()
									 WHERE id = $3`,
									[scheduledStatusId, maxRegisterDate, existingNotif[0].id],
								);
							}
							pendingNotifications.push({
								studentId: student.studentId,
								studentName: student.studentName,
								studentCode: student.studentCode,
								studentEmail: student.studentEmail,
								surveyId: existingSurvey.id,
								token: existingNotif[0].token,
								courseName: student.courseName,
								programName: student.programName,
							});
						}
					} else {
						const inserted = await manager.query(
							`INSERT INTO evidence.surveys
							 (survey_type_id, survey_status_type_id, student_id, academic_period_id, campus_id, program_id, course_section_id)
							 VALUES ($1, $2, $3, $4, $5, $6, $7)
							 RETURNING id`,
							[
								lcfcSurveyTypeId,
								activeStatusId,
								student.studentId,
								dto.academicPeriodId,
								campusId,
								programId,
								student.courseSectionId,
							],
						);

						const surveyId = inserted[0].id;
						const token = uuidv4();

						// max_register_date is NOT NULL; fall back to the column default when no
						// deadline is configured yet (it can be set later from Configuration).
						await manager.query(
							`INSERT INTO survey.notifications (survey_id, notification_status_type_id, token, max_register_date)
							 VALUES ($1, $2, $3, COALESCE($4, NOW()))`,
							[surveyId, scheduledStatusId, token, maxRegisterDate],
						);

						surveysCreated++;
						pendingNotifications.push({
							studentId: student.studentId,
							studentName: student.studentName,
							studentCode: student.studentCode,
							studentEmail: student.studentEmail,
							surveyId,
							token,
							courseName: student.courseName,
							programName: student.programName,
						});
					}
				}
			});
		} catch (err) {
			throw new BadRequestException(lcfcValidationStrings.error.processFailed, {
				description: (err as Error).message,
			});
		}
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

		for (const notif of pendingNotifications) {
			try {
				const surveyUrl = `${surveyBaseUrl}${SURVEY_FRONTEND_PATHS.LCFC}?token=${notif.token}`;
				const emailBody = this.surveyEmailTemplateService.replacePlaceholders(emailTemplate.body, {
					student_name: notif.studentName,
					student_code: notif.studentCode,
					course_name: notif.courseName,
					program_name: notif.programName,
					survey_link: surveyUrl,
					token: notif.token,
				});

				await this.mailService.sendRawEmail({
					to: notif.studentEmail,
					subject: emailTemplate.subject,
					html: emailBody,
				});

				await this.notifRepo.markAsSentBySurveyId(notif.surveyId, sentStatusId);
				emailsSent++;
			} catch (err) {
				emailsFailed++;
				errors.push(`Student ${notif.studentCode}: ${(err as Error).message}`);
			}
		}

		return {
			totalStudents: enrolledStudents.length,
			surveysCreated,
			alreadyExisted,
			emailsSent,
			emailsFailed,
			errors,
		};
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
		const commissionId =
			((config?.extra as Record<string, unknown>)?.commission_id as number | null) ?? null;

		const outcomes = await this.surveyRepo.getOutcomesForCourseSection(
			tokenData.courseSectionId,
			tokenData.programId,
			commissionId,
		);
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
			await this.dataSource.transaction(async (manager) => {
				for (const item of dto.scores) {
					const commentaries = i18nText(item.commentaries);
					const existing = await manager.query(
						`SELECT id FROM survey.scores WHERE survey_id = $1 AND outcome_id = $2 LIMIT 1`,
						[surveyId, item.outcomeId],
					);

					if (existing?.length > 0) {
						await manager.query(
							`UPDATE survey.scores SET score = $1, commentaries = $2, updated_at = NOW() WHERE survey_id = $3 AND outcome_id = $4`,
							[item.score, commentaries, surveyId, item.outcomeId],
						);
					} else {
						await manager.query(
							`INSERT INTO survey.scores (survey_id, outcome_id, score, commentaries) VALUES ($1, $2, $3, $4)`,
							[surveyId, item.outcomeId, item.score, commentaries],
						);
					}
				}

				const commentariesJson = dto.commentaries
					? JSON.stringify({ commentaries: dto.commentaries })
					: null;
				await manager.query(
					`UPDATE evidence.surveys
					 SET survey_status_type_id = $1, updated_at = NOW()
					     ${commentariesJson ? `, information = COALESCE(information::jsonb || $3::jsonb, $3::jsonb)` : ''}
					 WHERE id = $2`,
					commentariesJson
						? [closedStatusId, surveyId, commentariesJson]
						: [closedStatusId, surveyId],
				);
			});

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

	async getDashboard(dto: DashboardLcfcDto) {
		const { lcfcSurveyTypeId, activeStatusId, closedStatusId } = await this.getTypeIds();

		const data = await this.surveyRepo.getDashboardData(
			lcfcSurveyTypeId,
			activeStatusId,
			closedStatusId,
			{
				academicPeriodId: dto.academicPeriodId,
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
