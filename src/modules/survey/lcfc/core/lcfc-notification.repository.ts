import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { NotificationEntity } from 'src/modules/survey/notifications/model/notifications.entity';

@Injectable()
export class LcfcNotificationRepository extends BaseRepository {
	constructor(
		@InjectRepository(NotificationEntity)
		repository: Repository<NotificationEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	/** Finds notification by token with full details for validation and survey rendering */
	async findByTokenWithDetails(token: string): Promise<{
		notification_id: number;
		survey_id: number;
		student_id: number;
		student_name: string;
		student_code: string;
		program_id: number;
		program_name: string;
		academic_period_id: number;
		campus_id: number;
		course_section_id: number;
		max_register_date: string;
		notification_status: string;
		survey_status: string;
	} | null> {
		const rows = await this.dataSource.query(
			`SELECT
				n.id                   AS notification_id,
				n.survey_id,
				s.student_id,
				u.first_name || ' ' || u.last_name AS student_name,
				u.document_code::text              AS student_code,
				s.program_id,
				p.name->>'es'                      AS program_name,
				s.academic_period_id,
				s.campus_id,
				s.course_section_id,
				n.max_register_date,
				nt.name->>'es'                     AS notification_status,
				st2.name->>'es'                    AS survey_status
			FROM survey.notifications n
			INNER JOIN evidence.surveys s ON s.id = n.survey_id
			INNER JOIN academic.students st ON st.id = s.student_id
			INNER JOIN organization.users u ON u.id = st.user_id
			INNER JOIN academic.programs p ON p.id = s.program_id
			INNER JOIN core.types nt ON nt.id = n.notification_status_type_id
			INNER JOIN core.types st2 ON st2.id = s.survey_status_type_id
			WHERE n.token = $1
			LIMIT 1`,
			[token],
		);
		return rows?.[0] ?? null;
	}

	/** Gets all students enrolled in the given course sections with their info */
	async getEnrolledStudentsByCourses(courseSectionIds: number[]): Promise<
		{
			student_id: number;
			student_name: string;
			student_code: string;
			student_email: string;
			course_section_id: number;
			course_name: string;
			campus_id: number;
			program_id: number;
			program_name: string;
		}[]
	> {
		const rows = await this.dataSource.query(
			`SELECT DISTINCT
				st.id                                   AS student_id,
				u.first_name || ' ' || u.last_name     AS student_name,
				u.document_code::text                  AS student_code,
				u.email                                AS student_email,
				sse.course_section_id,
				c.name->>'es'                          AS course_name,
				cs.campus_id,
				sp.program_id,
				p.name->>'es'                          AS program_name
			FROM academic.student_section_enrollments sse
			INNER JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
			INNER JOIN academic.students st ON st.id = es.student_id
			INNER JOIN organization.users u ON u.id = st.user_id
			INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			INNER JOIN academic.study_plan_courses spc ON spc.id = cs.study_plan_course_id
			INNER JOIN academic.courses c ON c.id = spc.course_id
			INNER JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
			INNER JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			INNER JOIN academic.programs p ON p.id = sp.program_id
			WHERE sse.course_section_id = ANY($1)
			ORDER BY u.first_name ASC`,
			[courseSectionIds],
		);
		return rows ?? [];
	}

	/** Gets pending notifications for LCFC surveys in a period */
	async findLcfcPending(
		lcfcSurveyTypeId: number,
		scheduledStatusId: number,
		filters: {
			academic_period_id: number;
			program_id?: number;
			campus_id?: number;
			course_section_id?: number;
		},
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
			course_name: string;
			program_name: string;
		}[]
	> {
		let query = `
			SELECT
				n.id                                AS notification_id,
				n.token,
				n.max_register_date,
				n.survey_id,
				s.student_id,
				u.first_name || ' ' || u.last_name  AS student_name,
				u.document_code::text               AS student_code,
				u.email                             AS student_email,
				c.name->>'es'                       AS course_name,
				p.name->>'es'                       AS program_name
			FROM survey.notifications n
			INNER JOIN evidence.surveys s ON s.id = n.survey_id
			INNER JOIN academic.students st ON st.id = s.student_id
			INNER JOIN organization.users u ON u.id = st.user_id
			INNER JOIN academic.programs p ON p.id = s.program_id
			INNER JOIN academic.course_sections cs ON cs.id = s.course_section_id
			INNER JOIN academic.study_plan_courses spc ON spc.id = cs.study_plan_course_id
			INNER JOIN academic.courses c ON c.id = spc.course_id
			WHERE s.survey_type_id = $1
			  AND n.notification_status_type_id = $2
			  AND s.academic_period_id = $3
		`;
		const params: any[] = [lcfcSurveyTypeId, scheduledStatusId, filters.academic_period_id];

		if (filters.program_id) {
			query += ` AND s.program_id = $${params.length + 1}`;
			params.push(filters.program_id);
		}
		if (filters.campus_id) {
			query += ` AND s.campus_id = $${params.length + 1}`;
			params.push(filters.campus_id);
		}
		if (filters.course_section_id) {
			query += ` AND s.course_section_id = $${params.length + 1}`;
			params.push(filters.course_section_id);
		}

		return await this.dataSource.query(query, params);
	}

	/** Marks a notification as sent by survey_id */
	async markAsSentBySurveyId(surveyId: number, sentStatusId: number): Promise<void> {
		await this.dataSource.query(
			`UPDATE survey.notifications
			 SET notification_status_type_id = $1, sent_date = NOW(), updated_at = NOW()
			 WHERE survey_id = $2`,
			[sentStatusId, surveyId],
		);
	}

	/** Checks if a notification already exists for a survey */
	async existsForSurvey(surveyId: number): Promise<boolean> {
		const count = await this.repository.count({ where: { survey_id: surveyId } });
		return count > 0;
	}
}
