import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { NotificationEntity } from 'src/modules/survey/notifications/model/notifications.entity';
import { LcfcTokenData } from './lcfc.validation';

@Injectable()
export class LcfcNotificationRepository extends BaseRepository<NotificationEntity> {
	constructor(
		@InjectRepository(NotificationEntity)
		repository: Repository<NotificationEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	/** Finds notification by token with full details for validation and survey rendering */
	async findByTokenWithDetails(token: string): Promise<LcfcTokenData | null> {
		const rows = await this.dataSource.query(
			`SELECT
				n.survey_id            AS "surveyId",
				s.student_id           AS "studentId",
				u.first_name || ' ' || u.last_name AS "studentName",
				u.document_code::text              AS "studentCode",
				s.program_id           AS "programId",
				p.name->>'es'                      AS "programName",
				s.academic_period_id   AS "academicPeriodId",
				s.campus_id            AS "campusId",
				s.course_section_id    AS "courseSectionId",
				n.max_register_date    AS "maxRegisterDate",
				st2.code               AS "surveyStatusCode"
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

	/** Gets all students enrolled in the given course sections with their info */
	async getEnrolledStudentsByCourses(courseSectionIds: number[]): Promise<
		{
			studentId: number;
			studentName: string;
			studentCode: string;
			studentEmail: string;
			courseSectionId: number;
			courseName: string;
			campusId: number;
			programId: number;
			programName: string;
		}[]
	> {
		const rows = await this.dataSource.query(
			`SELECT DISTINCT
				st.id                                   AS "studentId",
				u.first_name || ' ' || u.last_name     AS "studentName",
				u.document_code::text                  AS "studentCode",
				u.email                                AS "studentEmail",
				sse.course_section_id                  AS "courseSectionId",
				c.name->>'es'                          AS "courseName",
				cs.campus_id                           AS "campusId",
				sp.program_id                          AS "programId",
				p.name->>'es'                          AS "programName"
			FROM academic.student_section_enrollments sse
			INNER JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
			INNER JOIN academic.students st ON st.id = es.student_id
			INNER JOIN organization.users u ON u.id = st.user_id
			INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			INNER JOIN academic.courses c ON c.id = cs.course_id
			INNER JOIN academic.study_plan_academic_periods spap ON spap.id = es.study_plan_academic_period
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
			academicPeriodId: number;
			programId?: number;
			campusId?: number;
			courseSectionId?: number;
		},
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
			courseName: string;
			programName: string;
		}[]
	> {
		let query = `
			SELECT
				n.id                                AS "notificationId",
				n.token                             AS "token",
				n.max_register_date                 AS "maxRegisterDate",
				n.survey_id                         AS "surveyId",
				s.student_id                        AS "studentId",
				u.first_name || ' ' || u.last_name  AS "studentName",
				u.document_code::text               AS "studentCode",
				u.email                             AS "studentEmail",
				c.name->>'es'                       AS "courseName",
				p.name->>'es'                       AS "programName"
			FROM survey.notifications n
			INNER JOIN evidence.surveys s ON s.id = n.survey_id
			INNER JOIN academic.students st ON st.id = s.student_id
			INNER JOIN organization.users u ON u.id = st.user_id
			INNER JOIN academic.programs p ON p.id = s.program_id
			INNER JOIN academic.course_sections cs ON cs.id = s.course_section_id
			INNER JOIN academic.courses c ON c.id = cs.course_id
			WHERE s.survey_type_id = $1
			  AND n.notification_status_type_id = $2
			  AND s.academic_period_id = $3
		`;
		const params: any[] = [lcfcSurveyTypeId, scheduledStatusId, filters.academicPeriodId];

		if (filters.programId) {
			query += ` AND s.program_id = $${params.length + 1}`;
			params.push(filters.programId);
		}
		if (filters.campusId) {
			query += ` AND s.campus_id = $${params.length + 1}`;
			params.push(filters.campusId);
		}
		if (filters.courseSectionId) {
			query += ` AND s.course_section_id = $${params.length + 1}`;
			params.push(filters.courseSectionId);
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
		const count = await this.repository.count({ where: { surveyId: surveyId } });
		return count > 0;
	}
}
