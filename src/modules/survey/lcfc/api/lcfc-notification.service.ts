import {
	Injectable,
	BadRequestException,
	Logger,
	InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
		const { lcfcSurveyTypeId, activeStatusId, scheduledStatusId, sentStatusId } =
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
		const maxRegisterDate = dto.maxRegisterDate ?? null;
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
					const programId = dto.programId ?? student.programId ?? config?.extra?.program_id ?? null;
					const campusId = dto.campusId ?? student.campusId ?? config?.extra?.campus_id ?? null;

					const existingSurvey = await this.surveyRepo.findExistingLcfcSurvey(
						lcfcSurveyTypeId,
						student.studentId,
						student.courseSectionId,
					);

					if (existingSurvey) {
						alreadyExisted++;
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
								// Reset to scheduled and push the new deadline so the reused token is valid again.
								await manager.query(
									`UPDATE survey.notifications
									 SET notification_status_type_id = $1, max_register_date = $2, sent_date = NULL, updated_at = NOW()
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

						await manager.query(
							`INSERT INTO survey.notifications (survey_id, notification_status_type_id, token, max_register_date)
							 VALUES ($1, $2, $3, $4)`,
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

	async getSurveyByToken(dto: GetLcfcSurveyByTokenDto) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(dto.token);
		LcfcValidation.validateToken(tokenData);
		// Show only the outcomes of the student's own program (a shared course can be
		// mapped to outcomes of several programs).
		const outcomes = await this.surveyRepo.getOutcomesForCourseSection(
			tokenData.courseSectionId,
			tokenData.programId,
		);
		const language = dto.language ?? 'es';

		const outcomeList = outcomes.map((o) => ({
			outcomeId: o.outcomeId,
			code: o.code,
			name: o.name,
			description: o.description ?? null,
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
			filters: dto,
		};
	}
}
