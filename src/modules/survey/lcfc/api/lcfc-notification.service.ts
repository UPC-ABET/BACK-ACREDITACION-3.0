import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from 'src/modules/mail/mail.service';
import { DataSource } from 'typeorm';
import { LcfcNotificationRepository } from '../core/lcfc-notification.repository';
import { LcfcSurveyRepository } from '../core/lcfc-survey.repository';
import { LcfcConfigRepository } from '../core/lcfc-config.repository';
import { LcfcValidation } from '../core/lcfc.validation';
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
			academic_period_id: dto.academic_period_id,
			program_id: dto.program_id,
			is_active: true,
		});

		if (activeConfigs.length === 0) {
			throw new BadRequestException(
				'No hay cursos LCFC activos para el período indicado. Genere y active configuraciones primero.',
			);
		}

		// 2. Collect active course_section_ids, applying optional filters
		let courseSectionIds = activeConfigs
			.map((c) => (c.extra as any)?.course_section_id as number)
			.filter((id): id is number => typeof id === 'number');

		if (dto.campus_id) {
			const campusId = dto.campus_id;
			courseSectionIds = courseSectionIds.filter((id) => {
				const cfg = activeConfigs.find((c) => (c.extra as any)?.course_section_id === id);
				return (cfg?.extra as any)?.campus_id === campusId;
			});
		}

		if (dto.course_section_id) {
			const csId = dto.course_section_id;
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
		const maxRegisterDate = dto.max_register_date ?? null;
		let surveysCreated = 0;
		let alreadyExisted = 0;
		const pendingNotifications: any[] = [];

		try {
			await this.dataSource.transaction(async (manager) => {
				for (const student of enrolledStudents) {
					const config = activeConfigs.find(
						(c) => (c.extra as any)?.course_section_id === student.course_section_id,
					);
					const programId =
						dto.program_id ?? student.program_id ?? (config?.extra as any)?.program_id ?? null;
					const campusId =
						dto.campus_id ?? student.campus_id ?? (config?.extra as any)?.campus_id ?? null;

					const existingSurvey = await this.surveyRepo.findExistingLcfcSurvey(
						lcfcSurveyTypeId,
						student.student_id,
						student.course_section_id,
					);

					if (!existingSurvey) {
						const inserted = await manager.query(
							`INSERT INTO evidence.surveys
							 (survey_type_id, survey_status_type_id, student_id, academic_period_id, campus_id, program_id, course_section_id)
							 VALUES ($1, $2, $3, $4, $5, $6, $7)
							 RETURNING id`,
							[
								lcfcSurveyTypeId,
								activeStatusId,
								student.student_id,
								dto.academic_period_id,
								campusId,
								programId,
								student.course_section_id,
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
							student_id: student.student_id,
							student_name: student.student_name,
							student_code: student.student_code,
							student_email: student.student_email,
							survey_id: surveyId,
							token,
							course_name: student.course_name,
							program_name: student.program_name,
						});
					} else {
						alreadyExisted++;
						const existingNotif = await manager.query(
							`SELECT id, token FROM survey.notifications WHERE survey_id = $1 AND notification_status_type_id = $2 LIMIT 1`,
							[existingSurvey.id, scheduledStatusId],
						);

						if (existingNotif?.[0]) {
							pendingNotifications.push({
								student_id: student.student_id,
								student_name: student.student_name,
								student_code: student.student_code,
								student_email: student.student_email,
								survey_id: existingSurvey.id,
								token: existingNotif[0].token,
								course_name: student.course_name,
								program_name: student.program_name,
							});
						}
					}
				}
			});
		} catch (err) {
			throw new BadRequestException(`Error al procesar encuestas LCFC: ${(err as Error).message}`);
		}

		// 5. Send emails to all pending notifications
		const surveyBaseUrl =
			dto.survey_base_url ||
			this.configService.get<string>('SURVEY_BASE_URL') ||
			'http://localhost:3001';
		const emailTemplate = await this.getEmailTemplate();

		let emailsSent = 0;
		let emailsFailed = 0;
		const errors: string[] = [];

		for (const notif of pendingNotifications) {
			try {
				const surveyUrl = `${surveyBaseUrl}/encuesta/lcfc?token=${notif.token}`;
				const emailBody = this.replacePlaceholders(emailTemplate.body, {
					NombreAlumno: notif.student_name,
					CodigoAlumno: notif.student_code,
					NombreCurso: notif.course_name,
					NombreCarrera: notif.program_name,
					LinkEncuesta: surveyUrl,
					Token: notif.token,
				});

				await this.mailService.sendRawEmail({
					to: notif.student_email,
					subject: emailTemplate.subject,
					html: emailBody,
				});

				await this.notifRepo.markAsSentBySurveyId(notif.survey_id, sentStatusId);
				emailsSent++;
			} catch (err) {
				emailsFailed++;
				errors.push(`Alumno ${notif.student_code}: ${(err as Error).message}`);
			}
		}

		return {
			total_students: enrolledStudents.length,
			surveys_created: surveysCreated,
			already_existed: alreadyExisted,
			emails_sent: emailsSent,
			emails_failed: emailsFailed,
			errors,
		};
	}

	// ─── Token validation ────────────────────────────────────────────────────────

	async validateToken(token: string) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(token);
		LcfcValidation.validateToken(tokenData, token);

		return {
			valid: true,
			survey_id: tokenData!.survey_id,
			student_id: tokenData!.student_id,
			student_name: tokenData!.student_name,
			student_code: tokenData!.student_code,
			program_id: tokenData!.program_id,
			program_name: tokenData!.program_name,
			academic_period_id: tokenData!.academic_period_id,
			course_section_id: tokenData!.course_section_id,
			max_register_date: tokenData!.max_register_date,
		};
	}

	// ─── Get survey form by token (outcomes to rate) ─────────────────────────────

	async getSurveyByToken(dto: GetLcfcSurveyByTokenDto) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(dto.token);
		LcfcValidation.validateToken(tokenData, dto.token);

		const outcomes = await this.surveyRepo.getOutcomesForCourseSection(
			tokenData!.course_section_id,
		);
		const language = dto.language ?? 'es';

		// Outcome names come from the DB in Spanish; English falls back to Spanish
		const outcomeList = outcomes.map((o) => ({
			outcome_id: o.outcome_id,
			code: o.code,
			name: o.name,
			description: o.description ?? null,
		}));

		return {
			survey_id: tokenData!.survey_id,
			student_id: tokenData!.student_id,
			student_name: tokenData!.student_name,
			program_id: tokenData!.program_id,
			course_section_id: tokenData!.course_section_id,
			language,
			outcomes: outcomeList,
		};
	}

	// ─── Complete survey with scores ─────────────────────────────────────────────

	async completeSurvey(dto: CompleteLcfcSurveyDto) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(dto.token);
		LcfcValidation.validateToken(tokenData, dto.token);
		LcfcValidation.validateCompleteScores(dto.scores);

		const { closedStatusId } = await this.getTypeIds();

		try {
			await this.dataSource.transaction(async (manager) => {
				for (const item of dto.scores) {
					const existing = await manager.query(
						`SELECT id FROM survey.scores WHERE survey_id = $1 AND outcome_id = $2 LIMIT 1`,
						[tokenData!.survey_id, item.outcome_id],
					);

					if (existing?.length > 0) {
						await manager.query(
							`UPDATE survey.scores SET score = $1, commentaries = $2, updated_at = NOW() WHERE survey_id = $3 AND outcome_id = $4`,
							[item.score, item.commentaries ?? null, tokenData!.survey_id, item.outcome_id],
						);
					} else {
						await manager.query(
							`INSERT INTO survey.scores (survey_id, outcome_id, score, commentaries) VALUES ($1, $2, $3, $4)`,
							[tokenData!.survey_id, item.outcome_id, item.score, item.commentaries ?? null],
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
						? [closedStatusId, tokenData!.survey_id, commentariesJson]
						: [closedStatusId, tokenData!.survey_id],
				);
			});

			return {
				success: true,
				survey_id: tokenData!.survey_id,
				scores_saved: dto.scores.length,
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
				academic_period_id: dto.academic_period_id,
				program_id: dto.program_id,
				campus_id: dto.campus_id,
			},
		);

		const completionRate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

		return {
			summary: {
				completed: data.completed,
				pending: data.pending,
				total: data.total,
				completion_rate_pct: completionRate,
			},
			by_course: data.by_course,
			filters: dto,
		};
	}

	// ─── Internal helpers ────────────────────────────────────────────────────────

	private async getEmailTemplate(): Promise<{ subject: string; body: string }> {
		const rows = await this.dataSource.query(
			`SELECT nm.title, nm.body
			 FROM survey.notification_messages nm
			 INNER JOIN core.types t ON t.id = nm.survey_type_id
			 WHERE t.code = 'TG601-T004'
			   AND nm.is_active = true
			 ORDER BY nm.id ASC
			 LIMIT 1`,
		);

		if (rows?.[0]) {
			return { subject: rows[0].title, body: rows[0].body };
		}

		return {
			subject: 'Encuesta de Logro de Fin de Ciclo (LCFC)',
			body: `<p>Estimado(a) [NombreAlumno],</p>
<p>Te invitamos a completar la encuesta de Logro de Fin de Ciclo para el curso <strong>[NombreCurso]</strong>.</p>
<p>Por favor accede al siguiente enlace para responder la encuesta:</p>
<p><a href="[LinkEncuesta]">Completar Encuesta LCFC</a></p>
<p>Token de acceso: [Token]</p>
<p>Saludos,<br/>Equipo ABET</p>`,
		};
	}

	private replacePlaceholders(template: string, data: Record<string, string>): string {
		let result = template;
		for (const [key, value] of Object.entries(data)) {
			result = result.replaceAll(`[${key}]`, value ?? '');
		}
		return result;
	}

}
