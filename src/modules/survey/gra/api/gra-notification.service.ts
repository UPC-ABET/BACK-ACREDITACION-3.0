import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from 'src/modules/mail/mail.service';
import { SurveyEmailService } from 'src/modules/survey/shared/survey-email.service';
import { DataSource } from 'typeorm';
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
		private readonly surveyEmailService: SurveyEmailService,
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
			dto.studentId,
			dto.academicPeriodId,
			dto.programId,
		);

		const courseSectionId = await this.surveyRepo.getDefaultCourseSectionId();

		// Crear la encuesta GRA si no existe
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
			surveyId: survey.id,
			notificationStatusTypeId: scheduledStatusId,
			token,
			maxRegisterDate: dto.maxRegisterDate,
		});

		return {
			notificationId: notification.id,
			surveyId: survey.id,
			studentId: dto.studentId,
			token,
			message: 'Estudiante agregado a la lista de encuesta GRA correctamente.',
		};
	}

	// ─── Listar estudiantes con estado de notificación ──────────────────────────

	async listStudents(dto: ListStudentsGraDto) {
		const { graSurveyTypeId } = await this.getTypeIds();
		return await this.notifRepo.listStudentsGra(graSurveyTypeId, {
			academicPeriodId: dto.academicPeriodId,
			programId: dto.programId,
			campusId: dto.campusId,
			studentCode: dto.studentCode,
		});
	}

	// ─── Eliminar notificación de la lista GRA ──────────────────────────────────

	async deleteNotification(id: number) {
		const notif = await this.notifRepo.findOneById(id);
		if (!notif) throw new NotFoundException(`Notificación GRA con ID ${id} no encontrada`);
		await this.notifRepo.remove(id);
		return { deleted: true, notificationId: id };
	}

	// ─── Enviar emails a estudiantes pendientes ─────────────────────────────────

	async sendEmails(dto: SendGraEmailDto) {
		const { graSurveyTypeId, scheduledStatusId, sentStatusId } = await this.getTypeIds();

		// Obtener estudiantes pendientes de notificación
		const pending = await this.notifRepo.findGraPending(graSurveyTypeId, scheduledStatusId, {
			academicPeriodId: dto.academicPeriodId,
			programId: dto.programId,
		});

		GraValidation.validateSendEmailRequest(pending.length);

		// Obtener template de email (notification_messages) - primer registro activo del tipo GRA
		const emailTemplate = await this.surveyEmailService.getEmailTemplate('TG601-T002');

		const surveyBaseUrl =
			dto.surveyBaseUrl ||
			this.configService.get<string>('SURVEY_BASE_URL') ||
			'http://localhost:3001';
		const results = { total: pending.length, sent: 0, failed: 0, errors: [] as string[] };

		for (const student of pending) {
			try {
				const surveyUrl = `${surveyBaseUrl}/encuesta/gra?token=${student.token}`;

				const emailBody = this.replacePlaceholders(emailTemplate.body, {
					NombreAlumno: student.studentName,
					CodigoAlumno: student.studentCode,
					NombreCarrera: student.programName,
					LinkEncuesta: surveyUrl,
					Token: student.token,
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
				results.errors.push(`Alumno ${student.studentCode}: ${(err as Error).message}`);
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
			surveyId: tokenData!.surveyId,
			studentId: tokenData!.studentId,
			studentName: tokenData!.studentName,
			studentCode: tokenData!.studentCode,
			programId: tokenData!.programId,
			programName: tokenData!.programName,
			academicPeriodId: tokenData!.academicPeriodId,
			maxRegisterDate: tokenData!.maxRegisterDate
		};
	}

	// ─── Obtener formulario GRA por token (outcomes a evaluar) ─────────────────

	async getSurveyByToken(dto: GetSurveyByTokenDto) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(dto.token);
		GraValidation.validateToken(tokenData, dto.token);

		// Cargar configuraciones GRA para el programa del estudiante
		const configs = await this.configRepo.findAllGra({
			programId: tokenData!.programId,
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
			surveyId: tokenData!.surveyId,
			studentId: tokenData!.studentId,
			studentName: tokenData!.studentName,
			programId: tokenData!.programId,
			outcomes,
		};
	}

	// ─── Completar encuesta GRA ─────────────────────────────────────────────────

	async completeSurvey(dto: CompleteGraSurveyDto) {
		const tokenData = await this.notifRepo.findByTokenWithDetails(dto.token);
		GraValidation.validateToken(tokenData, dto.token);
		GraValidation.validateCompleteScores(dto.scores);

		const { closedStatusId } = await this.getTypeIds();
		const surveyId = tokenData.survey_id;

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
						[tokenData!.surveyId, outcomeId],
					);

					if (existing?.length > 0) {
						await manager.query(
							`UPDATE survey.scores SET score = $1, commentaries = $2, updated_at = NOW() WHERE survey_id = $3 AND outcome_id = $4`,
							[item.score, item.commentaries ?? null, tokenData!.surveyId, outcomeId],
						);
					} else {
						await manager.query(
							`INSERT INTO survey.scores (survey_id, outcome_id, score, commentaries) VALUES ($1, $2, $3, $4)`,
							[tokenData!.surveyId, outcomeId, item.score, item.commentaries ?? null],
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
						? [closedStatusId, tokenData!.surveyId, commentariesJson]
						: [closedStatusId, tokenData!.surveyId],
				);
			});

			return {
				success: true,
				surveyId: tokenData!.surveyId,
				scoresSaved: dto.scores.length,
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
