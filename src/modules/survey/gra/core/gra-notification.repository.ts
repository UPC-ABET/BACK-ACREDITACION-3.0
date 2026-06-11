import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { NotificationEntity } from 'src/modules/survey/notifications/model/notifications.entity';
import { GraTokenData } from './gra.validation';

@Injectable()
export class GraNotificationRepository extends BaseRepository<NotificationEntity> {
	constructor(
		@InjectRepository(NotificationEntity)
		repository: Repository<NotificationEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	/** Busca una notificación GRA por token */
	async findByToken(token: string): Promise<NotificationEntity | null> {
		return await this.repository
			.createQueryBuilder('n')
			.innerJoin('evidence.surveys', 's', 's.id = n.survey_id')
			.addSelect([
				's.id',
				's.survey_type_id',
				's.student_id',
				's.program_id',
				's.academic_period_id',
				's.campus_id',
				's.survey_status_type_id',
			])
			.where('n.token = :token', { token })
			.getOne();
	}

	/** Busca todas las notificaciones GRA para un período y programa */
	async findGraPending(
		graSurveyTypeId: number,
		scheduledStatusId: number,
		filters: { academicPeriodId: number; programId?: number },
	): Promise<
		{
			notificationId: number;
			token: string;
			maxRegisterDate: string;
			surveyId: number;
			studentId: number;
			studentName: string;
			studentCode: string;
			studentEmail: string;
			programName: string;
		}[]
	> {
		let query = `
			SELECT
				n.id                               AS "notificationId",
				n.token,
				n.max_register_date                AS "maxRegisterDate",
				n.survey_id                        AS "surveyId",
				s.student_id                       AS "studentId",
				u.first_name || ' ' || u.last_name AS "studentName",
				u.document_code::text              AS "studentCode",
				u.email                            AS "studentEmail",
				p.name->>'es'                      AS "programName"
			FROM survey.notifications n
			INNER JOIN evidence.surveys s ON s.id = n.survey_id
			INNER JOIN academic.students st ON st.id = s.student_id
			INNER JOIN organization.users u ON u.id = st.user_id
			INNER JOIN academic.programs p ON p.id = s.program_id
			WHERE s.survey_type_id = $1
			  AND n.notification_status_type_id = $2
			  AND s.academic_period_id = $3
		`;
		const params: any[] = [graSurveyTypeId, scheduledStatusId, filters.academicPeriodId];

		if (filters.programId) {
			query += ` AND s.program_id = $${params.length + 1}`;
			params.push(filters.programId);
		}

		return await this.dataSource.query(query, params);
	}

	/** Lista estudiantes con estado de notificación GRA */
	async listStudentsGra(
		graSurveyTypeId: number,
		filters: {
			academicPeriodId?: number;
			programId?: number;
			campusId?: number;
			studentCode?: string;
		},
	): Promise<
		{
			notificationId: number;
			surveyId: number;
			studentId: number;
			studentName: string;
			studentCode: string;
			studentEmail: string;
			programName: string;
			notificationStatus: string;
			sentDate: string | null;
			maxRegisterDate: string;
			token: string;
		}[]
	> {
		let query = `
			SELECT
				n.id                               AS "notificationId",
				n.survey_id                        AS "surveyId",
				s.student_id                       AS "studentId",
				u.first_name || ' ' || u.last_name AS "studentName",
				u.document_code::text              AS "studentCode",
				u.email                            AS "studentEmail",
				p.name->>'es'                      AS "programName",
				t.name->>'es'                      AS "notificationStatus",
				n.sent_date                        AS "sentDate",
				n.max_register_date                AS "maxRegisterDate",
				n.token
			FROM survey.notifications n
			INNER JOIN evidence.surveys s ON s.id = n.survey_id
			INNER JOIN academic.students st ON st.id = s.student_id
			INNER JOIN organization.users u ON u.id = st.user_id
			INNER JOIN academic.programs p ON p.id = s.program_id
			INNER JOIN core.types t ON t.id = n.notification_status_type_id
			WHERE s.survey_type_id = $1
		`;
		const params: any[] = [graSurveyTypeId];

		if (filters.academicPeriodId) {
			query += ` AND s.academic_period_id = $${params.length + 1}`;
			params.push(filters.academicPeriodId);
		}
		if (filters.programId) {
			query += ` AND s.program_id = $${params.length + 1}`;
			params.push(filters.programId);
		}
		if (filters.campusId) {
			query += ` AND s.campus_id = $${params.length + 1}`;
			params.push(filters.campusId);
		}
		if (filters.studentCode) {
			query += ` AND u.document_code::text ILIKE $${params.length + 1}`;
			params.push(`%${filters.studentCode}%`);
		}

		query += ` ORDER BY u.first_name ASC`;

		return await this.dataSource.query(query, params);
	}

	/** Actualiza el estado y fecha de envío de una notificación */
	async markAsSent(notificationId: number, sentStatusId: number): Promise<void> {
		await this.dataSource.query(
			`UPDATE survey.notifications
			 SET notification_status_type_id = $1, sent_date = NOW(), updated_at = NOW()
			 WHERE id = $2`,
			[sentStatusId, notificationId],
		);
	}

	/** Finds a notification by token with full details for validation and survey rendering */
	async findByTokenWithDetails(token: string): Promise<GraTokenData | null> {
		const rows = await this.dataSource.query(
			`SELECT
				n.survey_id                        AS "surveyId",
				s.student_id                       AS "studentId",
				u.first_name || ' ' || u.last_name AS "studentName",
				u.document_code::text              AS "studentCode",
				s.program_id                       AS "programId",
				p.name->>'es'                      AS "programName",
				s.academic_period_id               AS "academicPeriodId",
				n.max_register_date                AS "maxRegisterDate",
				st2.code                           AS "surveyStatusCode"
			FROM survey.notifications n
			INNER JOIN evidence.surveys s ON s.id = n.survey_id
			INNER JOIN academic.students st ON st.id = s.student_id
			INNER JOIN organization.users u ON u.id = st.user_id
			INNER JOIN academic.programs p ON p.id = s.program_id
			INNER JOIN core.types st2 ON st2.id = s.survey_status_type_id
			WHERE n.token = $1
			LIMIT 1`,
			[token],
		);
		return rows?.[0] ?? null;
	}

	/** Verifica si ya existe una notificación GRA para un estudiante en un período */
	async existsForStudent(surveyId: number): Promise<boolean> {
		const count = await this.repository.count({ where: { surveyId: surveyId } });
		return count > 0;
	}
}
