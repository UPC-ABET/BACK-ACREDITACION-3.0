import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { NotificationEntity } from 'src/modules/survey/notifications/model/notifications.entity';

@Injectable()
export class GraNotificationRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(NotificationEntity)
		repository: Repository<NotificationEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	/** Busca una notificación GRA por token */
	async findByToken(token: string): Promise<NotificationEntity | null> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository
				.createQueryBuilder('n')
				.innerJoin('evidence.surveys', 's', 's.id = n.survey_id')
				.addSelect(['s.id', 's.survey_type_id', 's.student_id', 's.program_id', 's.academic_period_id', 's.campus_id', 's.survey_status_type_id'])
				.where('n.token = :token', { token })
				.getOne();
		} finally {
			await queryRunner.release();
		}
	}

	/** Busca todas las notificaciones GRA para un período y programa */
	async findGraPending(
		graSurveyTypeId: number,
		scheduledStatusId: number,
		filters: { academic_period_id: number; program_id?: number },
	): Promise<
		{
			notification_id: number;
			token: string;
			max_register_date: string;
			survey_id: number;
			student_id: number;
			student_name: string;
			student_code: string;
			student_email: string;
			program_name: string;
		}[]
	> {
		const { queryRunner } = await this.getRepository();
		try {
			let query = `
				SELECT
					n.id              AS notification_id,
					n.token,
					n.max_register_date,
					n.survey_id,
					s.student_id,
					st.name           AS student_name,
					st.code           AS student_code,
					st.institutional_email AS student_email,
					p.name            AS program_name
				FROM survey.notifications n
				INNER JOIN evidence.surveys s ON s.id = n.survey_id
				INNER JOIN academic.students st ON st.id = s.student_id
				INNER JOIN academic.programs p ON p.id = s.program_id
				WHERE s.survey_type_id = $1
				  AND n.notification_status_type_id = $2
				  AND s.academic_period_id = $3
			`;
			const params: any[] = [graSurveyTypeId, scheduledStatusId, filters.academic_period_id];

			if (filters.program_id) {
				query += ` AND s.program_id = $${params.length + 1}`;
				params.push(filters.program_id);
			}

			return await queryRunner.manager.query(query, params);
		} finally {
			await queryRunner.release();
		}
	}

	/** Lista estudiantes con estado de notificación GRA */
	async listStudentsGra(
		graSurveyTypeId: number,
		filters: { academic_period_id?: number; program_id?: number; campus_id?: number; student_code?: string },
	): Promise<
		{
			notification_id: number;
			survey_id: number;
			student_id: number;
			student_name: string;
			student_code: string;
			student_email: string;
			program_name: string;
			notification_status: string;
			sent_date: string | null;
			max_register_date: string;
			token: string;
		}[]
	> {
		const { queryRunner } = await this.getRepository();
		try {
			let query = `
				SELECT
					n.id                AS notification_id,
					n.survey_id,
					s.student_id,
					st.name             AS student_name,
					st.code             AS student_code,
					st.institutional_email AS student_email,
					p.name              AS program_name,
					t.name              AS notification_status,
					n.sent_date,
					n.max_register_date,
					n.token
				FROM survey.notifications n
				INNER JOIN evidence.surveys s ON s.id = n.survey_id
				INNER JOIN academic.students st ON st.id = s.student_id
				INNER JOIN academic.programs p ON p.id = s.program_id
				INNER JOIN core.types t ON t.id = n.notification_status_type_id
				WHERE s.survey_type_id = $1
			`;
			const params: any[] = [graSurveyTypeId];

			if (filters.academic_period_id) {
				query += ` AND s.academic_period_id = $${params.length + 1}`;
				params.push(filters.academic_period_id);
			}
			if (filters.program_id) {
				query += ` AND s.program_id = $${params.length + 1}`;
				params.push(filters.program_id);
			}
			if (filters.campus_id) {
				query += ` AND s.campus_id = $${params.length + 1}`;
				params.push(filters.campus_id);
			}
			if (filters.student_code) {
				query += ` AND st.code ILIKE $${params.length + 1}`;
				params.push(`%${filters.student_code}%`);
			}

			query += ` ORDER BY st.name ASC`;

			return await queryRunner.manager.query(query, params);
		} finally {
			await queryRunner.release();
		}
	}

	/** Actualiza el estado y fecha de envío de una notificación */
	async markAsSent(notificationId: number, sentStatusId: number): Promise<void> {
		const { queryRunner } = await this.getRepository();
		try {
			await queryRunner.manager.query(
				`UPDATE survey.notifications
				 SET notification_status_type_id = $1, sent_date = NOW(), updated_at = NOW()
				 WHERE id = $2`,
				[sentStatusId, notificationId],
			);
		} finally {
			await queryRunner.release();
		}
	}

	/** Busca una notificación por token (incluyendo datos del survey) para validación */
	async findByTokenWithDetails(token: string): Promise<{
		notification_id: number;
		survey_id: number;
		student_id: number;
		student_name: string;
		student_code: string;
		program_id: number;
		program_name: string;
		academic_period_id: number;
		max_register_date: string;
		notification_status: string;
		survey_status: string;
	} | null> {
		const { queryRunner } = await this.getRepository();
		try {
			const rows = await queryRunner.manager.query(
				`SELECT
					n.id                AS notification_id,
					n.survey_id,
					s.student_id,
					st.name             AS student_name,
					st.code             AS student_code,
					s.program_id,
					p.name              AS program_name,
					s.academic_period_id,
					n.max_register_date,
					nt.name             AS notification_status,
					st2.name            AS survey_status
				FROM survey.notifications n
				INNER JOIN evidence.surveys s ON s.id = n.survey_id
				INNER JOIN academic.students st ON st.id = s.student_id
				INNER JOIN academic.programs p ON p.id = s.program_id
				INNER JOIN core.types nt ON nt.id = n.notification_status_type_id
				INNER JOIN core.types st2 ON st2.id = s.survey_status_type_id
				WHERE n.token = $1
				LIMIT 1`,
				[token],
			);
			return rows?.[0] ?? null;
		} finally {
			await queryRunner.release();
		}
	}

	/** Verifica si ya existe una notificación GRA para un estudiante en un período */
	async existsForStudent(surveyId: number): Promise<boolean> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			const count = await repository.count({ where: { survey_id: surveyId } });
			return count > 0;
		} finally {
			await queryRunner.release();
		}
	}
}
