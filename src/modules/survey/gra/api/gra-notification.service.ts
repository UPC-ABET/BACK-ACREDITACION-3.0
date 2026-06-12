import {
	Injectable,
	BadRequestException,
	Logger,
	NotFoundException,
	InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from 'src/modules/mail/mail.service';
import { SurveyEmailTemplateService } from 'src/modules/survey/shared/survey-email.service';
import { SURVEY_FRONTEND_PATHS } from 'src/modules/survey/shared/survey-frontend-paths';
import { DataSource } from 'typeorm';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { GraNotificationRepository } from '../core/gra-notification.repository';
import { GraSurveyRepository } from '../core/gra-survey.repository';
import { GraConfigRepository } from '../core/gra-config.repository';
import { GraValidation } from '../core/gra.validation';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { graValidationStrings } from '../config/strings/gra.validation';
import {
	SaveGraNotificationDto,
	ListStudentsGraDto,
	SendGraEmailDto,
	GetSurveyByTokenDto,
	CompleteGraSurveyDto,
	DashboardGraDto,
} from '../model/gra.dtos';

@Injectable()
export class GraNotificationService {
	private readonly logger = new Logger(GraNotificationService.name);

	constructor(
		private readonly notifRepo: GraNotificationRepository,
		private readonly surveyRepo: GraSurveyRepository,
		private readonly configRepo: GraConfigRepository,
		private readonly dataSource: DataSource,
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

	async saveNotification(dto: SaveGraNotificationDto) {
		const { graSurveyTypeId, activeStatusId, scheduledStatusId } = await this.getTypeIds();

		let survey = await this.surveyRepo.findExistingGraSurvey(
			graSurveyTypeId,
			dto.studentId,
			dto.academicPeriodId,
			dto.programId,
		);

		const courseSectionId = await this.surveyRepo.getDefaultCourseSectionId();

		if (!survey) {
			survey = (await this.surveyRepo.create({
				surveyTypeId: graSurveyTypeId,
				surveyStatusTypeId: activeStatusId,
				studentId: dto.studentId,
				academicPeriodId: dto.academicPeriodId,
				campusId: dto.campusId,
				programId: dto.programId,
				courseSectionId: courseSectionId ?? 1,
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

	async listStudents(dto: ListStudentsGraDto) {
		const { graSurveyTypeId } = await this.getTypeIds();
		return await this.notifRepo.listStudentsGra(graSurveyTypeId, {
			academicPeriodId: dto.academicPeriodId,
			programId: dto.programId,
			campusId: dto.campusId,
			studentCode: dto.studentCode,
		});
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

	async sendEmails(dto: SendGraEmailDto) {
		const { graSurveyTypeId, scheduledStatusId, sentStatusId } = await this.getTypeIds();

		const pending = await this.notifRepo.findGraPending(graSurveyTypeId, scheduledStatusId, {
			academicPeriodId: dto.academicPeriodId,
			programId: dto.programId,
		});

		GraValidation.validateSendEmailRequest(pending.length);

		const emailTemplate = await this.surveyEmailTemplateService.getEmailTemplate(
			TYPE_CODES.SURVEY_TYPE.GRA,
			dto.lang ?? 'es',
		);

		const surveyBaseUrl =
			dto.surveyBaseUrl ||
			this.configService.get<string>('SURVEY_BASE_URL') ||
			'http://localhost:3001';
		const results = { total: pending.length, sent: 0, failed: 0, errors: [] as string[] };

		for (const student of pending) {
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
				results.sent++;
			} catch (err) {
				results.failed++;
				results.errors.push(`Student ${student.studentCode}: ${(err as Error).message}`);
			}
		}

		return results;
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
			await this.dataSource.transaction(async (manager) => {
				for (const item of dto.scores) {
					const configRows = await manager.query(
						`SELECT outcome_id FROM survey.outcome_configs WHERE id = $1 LIMIT 1`,
						[item.outcomeConfigId],
					);

					if (!configRows?.[0]) continue;

					const outcomeId = configRows[0].outcomeId;

					const existing = await manager.query(
						`SELECT id FROM survey.scores WHERE survey_id = $1 AND outcome_id = $2 LIMIT 1`,
						[surveyId, outcomeId],
					);

					if (existing?.length > 0) {
						await manager.query(
							`UPDATE survey.scores SET score = $1, commentaries = $2, updated_at = NOW() WHERE survey_id = $3 AND outcome_id = $4`,
							[item.score, item.commentaries ?? null, surveyId, outcomeId],
						);
					} else {
						await manager.query(
							`INSERT INTO survey.scores (survey_id, outcome_id, score, commentaries) VALUES ($1, $2, $3, $4)`,
							[surveyId, outcomeId, item.score, item.commentaries ?? null],
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
				message: graValidationStrings.success.completed,
			};
		} catch (err) {
			throw new BadRequestException(graValidationStrings.error.completeFailed, {
				description: (err as Error).message,
			});
		}
	}

	async getDashboard(dto: DashboardGraDto) {
		const { graSurveyTypeId, activeStatusId, closedStatusId } = await this.getTypeIds();

		const data = await this.surveyRepo.getDashboardData(
			graSurveyTypeId,
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
			byProgram: data.byProgram,
			filters: dto,
		};
	}
}
