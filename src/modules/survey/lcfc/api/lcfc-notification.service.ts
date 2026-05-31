import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from 'src/modules/mail/mail.service';
import { SurveyEmailService } from 'src/modules/survey/shared/survey-email.service';
import { DataSource } from 'typeorm';
import { LcfcNotificationRepository } from '../core/lcfc-notification.repository';
import { LcfcSurveyRepository } from '../core/lcfc-survey.repository';
import { LcfcConfigRepository } from '../core/lcfc-config.repository';
import { LcfcValidation } from '../core/lcfc.validation';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
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
		private readonly surveyEmailService: SurveyEmailService,
	) {}

	// ─── Helpers: resolve type IDs from core.types ──────────────────────────────

	private async getTypeIds() {
		const [lcfcSurveyTypeId, activeStatusId, closedStatusId, scheduledStatusId, sentStatusId] =
			await Promise.all([
				this.surveyRepo.getLcfcSurveyTypeId(),
				this.surveyRepo.getActiveSurveyStatusId(),
				this.surveyRepo.getClosedSurveyStatusId(),
				this.surveyRepo.getScheduledNotificationStatusId(),
				this.surveyRepo.getSentNotificationStatusId(),
			]);

		if (!lcfcSurveyTypeId)
			throw new BadRequestException(
				'Tipo de encuesta LCFC (TG601-T004) no encontrado. Ejecuta el seed de tipos.',
			);
		if (!activeStatusId)
			throw new BadRequestException(
				'Estado activo de encuesta (TG602-T001) no encontrado. Ejecuta el seed de tipos.',
			);
		if (!closedStatusId)
			throw new BadRequestException(
				'Estado cerrado de encuesta (TG602-T002) no encontrado. Ejecuta el seed de tipos.',
			);
		if (!scheduledStatusId)
			throw new BadRequestException(
				'Estado programada de notificación (TG1001-T001) no encontrado. Ejecuta el seed de tipos.',
			);
		if (!sentStatusId)
			throw new BadRequestException(
				'Estado enviada de notificación (TG1001-T002) no encontrado. Ejecuta el seed de tipos.',
			);

		return { lcfcSurveyTypeId, activeStatusId, closedStatusId, scheduledStatusId, sentStatusId };
	}

	// ─── Send notifications: creates surveys + notifications + sends emails ─────

	async sendNotifications(dto: SendLcfcNotificationDto) {
		const { lcfcSurveyTypeId, activeStatusId, scheduledStatusId, sentStatusId } =
			await this.getTypeIds();

		// 1. Load active LCFC configs for the period
		const activeConfigs = await this.configRepo.findAllLcfc({
			academicPeriodId: dto.academicPeriodId,
			programId: dto.programId,
			isActive: true,
		});

		if (activeConfigs.length === 0) {
			throw new BadRequestException(
				'No hay cursos LCFC activos para el período indicado. Genere y active configuraciones primero.',
			);
		}

		// 2. Collect active course_section_ids, applying optional filters
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
			throw new BadRequestException(
				'No hay secciones de curso activas que coincidan con los filtros indicados.',
			);
		}

		// 3. Get enrolled students for all relevant course sections
		const enrolledStudents = await this.notifRepo.getEnrolledStudentsByCourses(courseSectionIds);

		if (enrolledStudents.length === 0) {
			throw new BadRequestException(
				'No se encontraron estudiantes matriculados en los cursos LCFC activos.',
			);
		}

		// 4. Create surveys + notifications in a transaction for new student-course pairs
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
						(c) => c.extra?.courseSectionId === student.courseSectionId,
					);
					const programId = dto.programId ?? student.programId ?? config?.extra?.programId ?? null;
					const campusId = dto.campusId ?? student.campusId ?? config?.extra?.campusId ?? null;

					const existingSurvey = await this.surveyRepo.findExistingLcfcSurvey(
						lcfcSurveyTypeId,
						student.studentId,
						student.courseSectionId,
					);

					if (existingSurvey) {
						alreadyExisted++;
						const existingNotif = await manager.query(
							`SELECT id, token FROM survey.notifications WHERE survey_id = $1 AND notification_status_type_id = $2 LIMIT 1`,
							[existingSurvey.id, scheduledStatusId],
						);

						if (existingNotif?.[0]) {
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
			throw new BadRequestException(`Error al procesar encuestas LCFC: ${(err as Error).message}`);
		}

		// 5. Send emails to all pending notifications
		const surveyBaseUrl =
			dto.surveyBaseUrl ||
			this.configService.get<string>('SURVEY_BASE_URL') ||
			'http://localhost:3001';
		const emailTemplate = await this.surveyEmailService.getEmailTemplate(
			TYPE_CODES.SURVEY_TYPE.LCFC,
		);

		let emailsSent = 0;
		let emailsFailed = 0;
		const errors: string[] = [];

		for (const notif of pendingNotifications) {
			try {
				const surveyUrl = `${surveyBaseUrl}/encuesta/lcfc?token=${notif.token}`;
				const emailBody = this.surveyEmailService.replacePlaceholders(emailTemplate.body, {
					NombreAlumno: notif.studentName,
					CodigoAlumno: notif.studentCode,
					NombreCurso: notif.courseName,
					NombreCarrera: notif.programName,
					LinkEncuesta: surveyUrl,
					Token: notif.token,
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
				errors.push(`Alumno ${notif.studentCode}: ${(err as Error).message}`);
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

	// ─── Token validation ────────────────────────────────────────────────────────

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
			courseSectionId: tokenData.courseSectionId,
			maxRegisterDate: tokenData.maxRegisterDate,
		};
	}

	// ─── Get survey form by token (outcomes to rate) ─────────────────────────────

	async getSurveyByToken(dto: GetLcfcSurveyByTokenDto) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(dto.token);
		LcfcValidation.validateToken(tokenData);
		const outcomes = await this.surveyRepo.getOutcomesForCourseSection(tokenData.courseSectionId);
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

	// ─── Complete survey with scores ─────────────────────────────────────────────

	async completeSurvey(dto: CompleteLcfcSurveyDto) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(dto.token);
		LcfcValidation.validateToken(tokenData);
		LcfcValidation.validateCompleteScores(dto.scores);

		const { closedStatusId } = await this.getTypeIds();
		const surveyId = tokenData.surveyId;

		try {
			await this.dataSource.transaction(async (manager) => {
				for (const item of dto.scores) {
					const existing = await manager.query(
						`SELECT id FROM survey.scores WHERE survey_id = $1 AND outcome_id = $2 LIMIT 1`,
						[surveyId, item.outcomeId],
					);

					if (existing?.length > 0) {
						await manager.query(
							`UPDATE survey.scores SET score = $1, commentaries = $2, updated_at = NOW() WHERE survey_id = $3 AND outcome_id = $4`,
							[item.score, item.commentaries ?? null, surveyId, item.outcomeId],
						);
					} else {
						await manager.query(
							`INSERT INTO survey.scores (survey_id, outcome_id, score, commentaries) VALUES ($1, $2, $3, $4)`,
							[surveyId, item.outcomeId, item.score, item.commentaries ?? null],
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
				message: 'Encuesta LCFC completada exitosamente. ¡Gracias por tu participación!',
			};
		} catch (err) {
			throw new BadRequestException(`Error al guardar la encuesta LCFC: ${(err as Error).message}`);
		}
	}

	// ─── Dashboard ───────────────────────────────────────────────────────────────

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
