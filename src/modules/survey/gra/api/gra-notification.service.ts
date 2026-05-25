import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from 'src/modules/mail/mail.service';
import { DataSource } from 'typeorm';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { GraNotificationRepository } from '../core/gra-notification.repository';
import { GraSurveyRepository } from '../core/gra-survey.repository';
import { GraConfigRepository } from '../core/gra-config.repository';
import { GraValidation } from '../core/gra.validation';
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
	) {}

	// ─── Helpers: obtener IDs de tipos ─────────────────────────────────────────

	private async getTypeIds() {
		const [graSurveyTypeId, activeStatusId, closedStatusId, scheduledStatusId, sentStatusId] =
			await Promise.all([
				this.surveyRepo.getGraSurveyTypeId(),
				this.surveyRepo.getActiveSurveyStatusId(),
				this.surveyRepo.getClosedSurveyStatusId(),
				this.surveyRepo.getScheduledNotificationStatusId(),
				this.surveyRepo.getSentNotificationStatusId(),
			]);

		if (!graSurveyTypeId)
			throw new BadRequestException(
				'Tipo de encuesta GRA (TG601-T002) no encontrado. Ejecuta el seed de tipos.',
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

		return { graSurveyTypeId, activeStatusId, closedStatusId, scheduledStatusId, sentStatusId };
	}

	// ─── Guardar notificación (agregar estudiante a lista GRA) ─────────────────

	async saveNotification(dto: SaveGraNotificationDto) {
		const { graSurveyTypeId, activeStatusId, scheduledStatusId } = await this.getTypeIds();

		// Buscar encuesta GRA existente para este estudiante + período + programa
		let survey = await this.surveyRepo.findExistingGraSurvey(
			graSurveyTypeId,
			dto.student_id,
			dto.academic_period_id,
			dto.program_id,
		);

		const courseSectionId = await this.surveyRepo.getDefaultCourseSectionId();

		// Crear la encuesta GRA si no existe
		if (!survey) {
			survey = (await this.surveyRepo.create({
				survey_type_id: graSurveyTypeId,
				survey_status_type_id: activeStatusId,
				student_id: dto.student_id,
				academic_period_id: dto.academic_period_id,
				campus_id: dto.campus_id,
				program_id: dto.program_id,
				course_section_id: courseSectionId ?? 1,
			})) as SurveyEntity;
		}

		// Verificar si ya existe notificación para esta encuesta
		const alreadyNotified = await this.notifRepo.existsForStudent(survey.id);
		if (alreadyNotified) {
			throw new BadRequestException(
				`El estudiante ya se encuentra en la lista de encuesta GRA para este período y programa.`,
			);
		}

		// Generar token único
		const token = uuidv4();

		// Crear notificación
		const notification = await this.notifRepo.create({
			survey_id: survey.id,
			notification_status_type_id: scheduledStatusId,
			token,
			max_register_date: dto.max_register_date,
		});

		return {
			notification_id: notification.id,
			survey_id: survey.id,
			student_id: dto.student_id,
			token,
			message: 'Estudiante agregado a la lista de encuesta GRA correctamente.',
		};
	}

	// ─── Listar estudiantes con estado de notificación ──────────────────────────

	async listStudents(dto: ListStudentsGraDto) {
		const { graSurveyTypeId } = await this.getTypeIds();
		return await this.notifRepo.listStudentsGra(graSurveyTypeId, {
			academic_period_id: dto.academic_period_id,
			program_id: dto.program_id,
			campus_id: dto.campus_id,
			student_code: dto.student_code,
		});
	}

	// ─── Eliminar notificación de la lista GRA ──────────────────────────────────

	async deleteNotification(id: number) {
		const notif = await this.notifRepo.findOneById(id);
		if (!notif) throw new NotFoundException(`Notificación GRA con ID ${id} no encontrada`);
		await this.notifRepo.remove(id);
		return { deleted: true, notification_id: id };
	}

	// ─── Enviar emails a estudiantes pendientes ─────────────────────────────────

	async sendEmails(dto: SendGraEmailDto) {
		const { graSurveyTypeId, scheduledStatusId, sentStatusId } = await this.getTypeIds();

		// Obtener estudiantes pendientes de notificación
		const pending = await this.notifRepo.findGraPending(graSurveyTypeId, scheduledStatusId, {
			academic_period_id: dto.academic_period_id,
			program_id: dto.program_id,
		});

		GraValidation.validateSendEmailRequest(pending.length);

		// Obtener template de email (notification_messages) - primer registro activo del tipo GRA
		const emailTemplate = await this.getEmailTemplate();

		const surveyBaseUrl =
			dto.survey_base_url ||
			this.configService.get<string>('SURVEY_BASE_URL') ||
			'http://localhost:3001';
		const results = { total: pending.length, sent: 0, failed: 0, errors: [] as string[] };

		for (const student of pending) {
			try {
				const surveyUrl = `${surveyBaseUrl}/encuesta/gra?token=${student.token}`;

				const emailBody = this.replacePlaceholders(emailTemplate.body, {
					NombreAlumno: student.student_name,
					CodigoAlumno: student.student_code,
					NombreCarrera: student.program_name,
					LinkEncuesta: surveyUrl,
					Token: student.token,
				});

				await this.mailService.sendRawEmail({
					to: student.student_email,
					subject: emailTemplate.subject,
					html: emailBody,
				});

				await this.notifRepo.markAsSent(student.notification_id, sentStatusId);
				results.sent++;
			} catch (err) {
				results.failed++;
				results.errors.push(`Alumno ${student.student_code}: ${(err as Error).message}`);
			}
		}

		return results;
	}

	// ─── Validar token (sin autenticación requerida) ────────────────────────────

	async validateToken(token: string) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(token);
		GraValidation.validateToken(tokenData, token);

		return {
			valid: true,
			survey_id: tokenData!.survey_id,
			student_id: tokenData!.student_id,
			student_name: tokenData!.student_name,
			student_code: tokenData!.student_code,
			program_id: tokenData!.program_id,
			program_name: tokenData!.program_name,
			academic_period_id: tokenData!.academic_period_id,
			max_register_date: tokenData!.max_register_date,
		};
	}

	// ─── Obtener formulario GRA por token (outcomes a evaluar) ─────────────────

	async getSurveyByToken(dto: GetSurveyByTokenDto) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(dto.token);
		GraValidation.validateToken(tokenData, dto.token);

		// Cargar configuraciones GRA para el programa del estudiante
		const configs = await this.configRepo.findAllGra({
			program_id: tokenData!.program_id,
			is_active: true,
			is_visible: true,
		});

		const language = dto.language ?? 'es';

		const outcomes = configs.map((cfg) => {
			const extra = (cfg.extra as Record<string, any>) ?? {};
			return {
				outcome_config_id: cfg.id,
				outcome_id: cfg.outcome_id,
				name: language === 'en' && extra.name_en ? extra.name_en : cfg.user_outcome_name,
				description:
					language === 'en' && extra.description_en
						? extra.description_en
						: (cfg.user_outcome_description ?? null),
				order: extra.order ?? null,
			};
		});

		return {
			survey_id: tokenData!.survey_id,
			student_id: tokenData!.student_id,
			student_name: tokenData!.student_name,
			program_id: tokenData!.program_id,
			outcomes,
		};
	}

	// ─── Completar encuesta GRA ─────────────────────────────────────────────────

	async completeSurvey(dto: CompleteGraSurveyDto) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(dto.token);
		GraValidation.validateToken(tokenData, dto.token);
		GraValidation.validateCompleteScores(dto.scores);

		const { closedStatusId } = await this.getTypeIds();

		try {
			await this.dataSource.transaction(async (manager) => {
				for (const item of dto.scores) {
					const configRows = await manager.query(
						`SELECT outcome_id FROM survey.outcome_configs WHERE id = $1 LIMIT 1`,
						[item.outcome_config_id],
					);

					if (!configRows?.[0]) continue;

					const outcomeId = configRows[0].outcome_id;

					const existing = await manager.query(
						`SELECT id FROM survey.scores WHERE survey_id = $1 AND outcome_id = $2 LIMIT 1`,
						[tokenData!.survey_id, outcomeId],
					);

					if (existing?.length > 0) {
						await manager.query(
							`UPDATE survey.scores SET score = $1, commentaries = $2, updated_at = NOW() WHERE survey_id = $3 AND outcome_id = $4`,
							[item.score, item.commentaries ?? null, tokenData!.survey_id, outcomeId],
						);
					} else {
						await manager.query(
							`INSERT INTO survey.scores (survey_id, outcome_id, score, commentaries) VALUES ($1, $2, $3, $4)`,
							[tokenData!.survey_id, outcomeId, item.score, item.commentaries ?? null],
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
				message: 'Encuesta GRA completada exitosamente. ¡Gracias por tu participación!',
			};
		} catch (err) {
			throw new BadRequestException(`Error al guardar la encuesta GRA: ${(err as Error).message}`);
		}
	}

	// ─── Dashboard GRA ──────────────────────────────────────────────────────────

	async getDashboard(dto: DashboardGraDto) {
		const { graSurveyTypeId, activeStatusId, closedStatusId } = await this.getTypeIds();

		const data = await this.surveyRepo.getDashboardData(
			graSurveyTypeId,
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
			by_program: data.by_program,
			filters: dto,
		};
	}

	// ─── Helpers internos ────────────────────────────────────────────────────────

	private async getEmailTemplate(): Promise<{ subject: string; body: string }> {
		const rows = await this.dataSource.query(
			`SELECT nm.title, nm.body
			 FROM survey.notification_messages nm
			 INNER JOIN core.types t ON t.id = nm.survey_type_id
			 WHERE t.code = 'TG601-T002'
			   AND nm.is_active = true
			 ORDER BY nm.id ASC
			 LIMIT 1`,
		);

		if (rows?.[0]) {
			return {
				subject: rows[0].title,
				body: rows[0].body,
			};
		}

		return {
			subject: 'Encuesta de Competencias de Graduandos',
			body: `<p>Estimado(a) [NombreAlumno],</p>
<p>Te invitamos a completar la encuesta de competencias de graduandos. Por favor accede al siguiente enlace:</p>
<p><a href="[LinkEncuesta]">Completar Encuesta</a></p>
<p>Token: [Token]</p>
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
