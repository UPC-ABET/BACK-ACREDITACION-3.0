import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { NotificationEntity } from 'src/modules/survey/notifications/model/notifications.entity';
import { GraTokenData } from './gra.validation';

export interface GraScoreItem {
	outcomeConfigId: number;
	score: number;
	commentaries: unknown;
}

@Injectable()
export class GraNotificationRepository extends BaseRepository<NotificationEntity> {
	constructor(
		@InjectRepository(NotificationEntity)
		repository: Repository<NotificationEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

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
				s.student_id                         AS "studentId",
				st.first_name || ' ' || st.last_name AS "studentName",
				st.code                              AS "studentCode",
				st.email                             AS "studentEmail",
				p.name->>'es'                        AS "programName"
			FROM survey.notifications n
			INNER JOIN evidence.surveys s ON s.id = n.survey_id
			INNER JOIN academic.students st ON st.id = s.student_id
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

	/** Notification + student details for a single row, regardless of its send status
	 *  (used for the per-row "resend" action). */
	async findNotificationDetailsById(notificationId: number): Promise<{
		notificationId: number;
		token: string;
		surveyId: number;
		studentId: number;
		studentName: string;
		studentCode: string;
		studentEmail: string;
		programName: string;
		surveyStatusTypeId: number;
	} | null> {
		const rows = await this.dataSource.query(
			`SELECT
				n.id                                 AS "notificationId",
				n.token,
				n.survey_id                          AS "surveyId",
				s.student_id                         AS "studentId",
				st.first_name || ' ' || st.last_name AS "studentName",
				st.code                              AS "studentCode",
				st.email                             AS "studentEmail",
				p.name->>'es'                        AS "programName",
				s.survey_status_type_id              AS "surveyStatusTypeId"
			FROM survey.notifications n
			INNER JOIN evidence.surveys s ON s.id = n.survey_id
			INNER JOIN academic.students st ON st.id = s.student_id
			INNER JOIN academic.programs p ON p.id = s.program_id
			WHERE n.id = $1
			LIMIT 1`,
			[notificationId],
		);
		return rows?.[0] ?? null;
	}

	async listStudentsGra(
		graSurveyTypeId: number,
		closedStatusId: number,
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
			responseStatus: string | null;
			responseDate: string | null;
		}[]
	> {
		let query = `
			SELECT
				n.id                               AS "notificationId",
				n.survey_id                        AS "surveyId",
				s.student_id                         AS "studentId",
				st.first_name || ' ' || st.last_name AS "studentName",
				st.code                              AS "studentCode",
				st.email                             AS "studentEmail",
				p.name->>'es'                        AS "programName",
				t.name->>'es'                        AS "notificationStatus",
				n.sent_date                          AS "sentDate",
				n.max_register_date                  AS "maxRegisterDate",
				n.token,
				CASE WHEN s.survey_status_type_id = $2 THEN 'RESPONDIDO' ELSE NULL END AS "responseStatus",
				CASE WHEN s.survey_status_type_id = $2 THEN s.updated_at ELSE NULL END AS "responseDate"
			FROM survey.notifications n
			INNER JOIN evidence.surveys s ON s.id = n.survey_id
			INNER JOIN academic.students st ON st.id = s.student_id
			INNER JOIN academic.programs p ON p.id = s.program_id
			INNER JOIN core.types t ON t.id = n.notification_status_type_id
			WHERE s.survey_type_id = $1
		`;
		const params: any[] = [graSurveyTypeId, closedStatusId];

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
			query += ` AND st.code ILIKE $${params.length + 1}`;
			params.push(`%${filters.studentCode}%`);
		}

		query += ` ORDER BY st.first_name ASC`;

		return await this.dataSource.query(query, params);
	}

	/** Pending (scheduled, not yet sent) GRA students grouped by program, for the send-summary preview. */
	async findPendingSummaryByProgram(
		graSurveyTypeId: number,
		scheduledStatusId: number,
		filters: { academicPeriodId: number; programId?: number },
	): Promise<Array<{ programId: number; programName: string; studentCount: number }>> {
		let query = `
			SELECT
				s.program_id  AS "programId",
				p.name->>'es' AS "programName",
				COUNT(*)::int AS "studentCount"
			FROM survey.notifications n
			INNER JOIN evidence.surveys s ON s.id = n.survey_id
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

		query += ` GROUP BY s.program_id, p.name ORDER BY p.name`;

		return await this.dataSource.query(query, params);
	}

	async markAsSent(notificationId: number, sentStatusId: number): Promise<void> {
		await this.dataSource.query(
			`UPDATE survey.notifications
			 SET notification_status_type_id = $1, sent_date = NOW(), updated_at = NOW()
			 WHERE id = $2`,
			[sentStatusId, notificationId],
		);
	}

	async findByTokenWithDetails(token: string): Promise<GraTokenData | null> {
		const rows = await this.dataSource.query(
			`SELECT
				n.survey_id                        AS "surveyId",
				s.student_id                         AS "studentId",
				st.first_name || ' ' || st.last_name AS "studentName",
				st.code                              AS "studentCode",
				s.program_id                         AS "programId",
				p.name->>'es'                        AS "programName",
				s.academic_period_id                 AS "academicPeriodId",
				n.max_register_date                  AS "maxRegisterDate",
				st2.code                             AS "surveyStatusCode"
			FROM survey.notifications n
			INNER JOIN evidence.surveys s ON s.id = n.survey_id
			INNER JOIN academic.students st ON st.id = s.student_id
			INNER JOIN academic.programs p ON p.id = s.program_id
			INNER JOIN core.types st2 ON st2.id = s.survey_status_type_id
			WHERE n.token = $1
			LIMIT 1`,
			[token],
		);
		return rows?.[0] ?? null;
	}

	async existsForStudent(surveyId: number): Promise<boolean> {
		const count = await this.repository.count({ where: { surveyId: surveyId } });
		return count > 0;
	}

	async findEmailTemplateByCode(code: string): Promise<{
		code: string;
		name: unknown;
		subject: unknown;
		body: unknown;
	} | null> {
		const rows = await this.dataSource.query(
			`SELECT code, name, subject, body FROM core.email_templates WHERE code = $1 LIMIT 1`,
			[code],
		);
		return rows?.[0] ?? null;
	}

	async upsertEmailTemplate(params: {
		code: string;
		categoryCode: string;
		name: string;
		subject: string;
		body: string;
	}): Promise<{ code: string; name: unknown; subject: unknown; body: unknown } | null> {
		const rows = await this.dataSource.query(
			`INSERT INTO core.email_templates (category_type_id, code, name, subject, body)
			 SELECT cat.id, $1, $2::jsonb, $3::jsonb, $4::jsonb
			 FROM core.types cat WHERE cat.code = $5
			 ON CONFLICT ON CONSTRAINT "UQ_email_templates_code" DO UPDATE
			 SET subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = NOW()
			 RETURNING code, name, subject, body`,
			[params.code, params.name, params.subject, params.body, params.categoryCode],
		);
		return rows?.[0] ?? null;
	}

	/**
	 * Upserts the outcome scores for a GRA survey (resolving each outcome from its
	 * outcome_config) and marks the survey closed, optionally merging a general comment into
	 * evidence.surveys.information — all in one transaction. Score items whose outcome_config
	 * cannot be resolved are skipped.
	 */
	async saveScoresAndCloseSurvey(
		surveyId: number,
		closedStatusId: number,
		scores: GraScoreItem[],
		generalComment?: string,
	): Promise<void> {
		await this.dataSource.transaction(async (manager: EntityManager) => {
			for (const item of scores) {
				const configRows: { outcomeId: number }[] = await manager.query(
					`SELECT outcome_id AS "outcomeId" FROM survey.outcome_configs WHERE id = $1 LIMIT 1`,
					[item.outcomeConfigId],
				);

				if (!configRows?.[0]) continue;

				const outcomeId = configRows[0].outcomeId;

				const existing: { id: number }[] = await manager.query(
					`SELECT id FROM survey.scores WHERE survey_id = $1 AND outcome_id = $2 LIMIT 1`,
					[surveyId, outcomeId],
				);

				if (existing?.length > 0) {
					await manager.query(
						`UPDATE survey.scores SET score = $1, commentaries = $2, updated_at = NOW() WHERE survey_id = $3 AND outcome_id = $4`,
						[item.score, item.commentaries, surveyId, outcomeId],
					);
				} else {
					await manager.query(
						`INSERT INTO survey.scores (survey_id, outcome_id, score, commentaries) VALUES ($1, $2, $3, $4)`,
						[surveyId, outcomeId, item.score, item.commentaries],
					);
				}
			}

			const commentariesJson = generalComment
				? JSON.stringify({ commentaries: generalComment })
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
	}
}
