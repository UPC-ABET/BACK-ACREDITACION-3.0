import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from 'src/commons/base.repository';
import { NotificationEntity } from 'src/modules/survey/notifications/model/notifications.entity';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { LcfcTokenData } from './lcfc.validation';

export interface LcfcSendCandidate {
	studentId: number;
	studentName: string;
	studentCode: string;
	studentEmail: string;
	courseSectionId: number;
	courseName: string;
	programName: string;
	programId: number | null;
	campusId: number | null;
}

export interface LcfcPendingNotification {
	studentId: number;
	studentName: string;
	studentCode: string;
	studentEmail: string;
	surveyId: number;
	token: string;
	courseName: string;
	programName: string;
}

export interface LcfcScoreItem {
	outcomeId: number;
	score: number;
	commentaries: unknown;
}

@Injectable()
export class LcfcNotificationRepository extends BaseRepository<NotificationEntity> {
	constructor(
		@InjectRepository(NotificationEntity)
		repository: Repository<NotificationEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findByTokenWithDetails(token: string): Promise<LcfcTokenData | null> {
		const rows = await this.dataSource.query(
			`SELECT
				n.survey_id            AS "surveyId",
				s.student_id           AS "studentId",
				st.first_name || ' ' || st.last_name AS "studentName",
				st.code                            AS "studentCode",
				s.program_id           AS "programId",
				p.name->>'es'                      AS "programName",
				s.academic_period_id   AS "academicPeriodId",
				ap.code                            AS "period",
				c.name->>'es'                      AS "courseName",
				s.campus_id            AS "campusId",
				s.course_section_id    AS "courseSectionId",
				n.max_register_date    AS "maxRegisterDate",
				st2.code               AS "surveyStatusCode"
			FROM survey.notifications n
			INNER JOIN evidence.surveys s ON s.id = n.survey_id
			INNER JOIN academic.students st ON st.id = s.student_id
			INNER JOIN academic.programs p ON p.id = s.program_id
			INNER JOIN core.types st2 ON st2.id = s.survey_status_type_id
			LEFT JOIN academic.academic_periods ap ON ap.id = s.academic_period_id
			LEFT JOIN academic.course_sections cs ON cs.id = s.course_section_id
			LEFT JOIN academic.courses c ON c.id = cs.course_id
			WHERE n.token = $1
			LIMIT 1`,
			[token],
		);
		return rows?.[0] ?? null;
	}

	/**
	 * Lists ALL surveys (LCFC + GRA) of the student that owns the given token (same period).
	 * The token may come from either an LCFC or GRA notification — both are resolved.
	 */
	async getStudentSurveysByToken(token: string): Promise<{
		studentName: string;
		studentCode: string;
		programName: string;
		period: string;
		surveys: {
			token: string;
			courseName: string;
			sectionCode: string;
			completed: boolean;
			surveyType: string;
		}[];
	} | null> {
		const rows = await this.dataSource.query(
			`WITH src AS (
				SELECT s.student_id, s.academic_period_id
				FROM survey.notifications n
				INNER JOIN evidence.surveys s ON s.id = n.survey_id
				WHERE n.token = $1
				LIMIT 1
			)
			SELECT
				n.token                              AS "token",
				st.first_name || ' ' || st.last_name AS "studentName",
				st.code                              AS "studentCode",
				p.name->>'es'                        AS "programName",
				ap.code                              AS "period",
				CASE
					WHEN s.survey_type_id = (SELECT id FROM core.types WHERE code = $4) THEN 'Encuesta de Graduandos'
					ELSE COALESCE(c.name->>'es', 'Encuesta')
				END                                  AS "courseName",
				cs.section_code                      AS "sectionCode",
				(stt.code = $3)                      AS "completed",
				CASE s.survey_type_id
					WHEN (SELECT id FROM core.types WHERE code = $2) THEN 'LCFC'
					WHEN (SELECT id FROM core.types WHERE code = $4) THEN 'GRA'
					ELSE 'UNKNOWN'
				END                                  AS "surveyType"
			FROM evidence.surveys s
			INNER JOIN survey.notifications n ON n.survey_id = s.id
			INNER JOIN academic.students st ON st.id = s.student_id
			INNER JOIN academic.programs p ON p.id = s.program_id
			INNER JOIN core.types stt ON stt.id = s.survey_status_type_id
			LEFT JOIN academic.academic_periods ap ON ap.id = s.academic_period_id
			LEFT JOIN academic.course_sections cs ON cs.id = s.course_section_id
			LEFT JOIN academic.courses c ON c.id = cs.course_id
			WHERE s.student_id = (SELECT student_id FROM src)
			  AND s.academic_period_id = (SELECT academic_period_id FROM src)
			  AND s.survey_type_id IN (
			      SELECT id FROM core.types WHERE code IN ($2, $4)
			  )
			ORDER BY "surveyType" ASC, c.name->>'es' ASC NULLS LAST`,
			[
				token,
				TYPE_CODES.SURVEY_TYPE.LCFC,
				TYPE_CODES.SURVEY_STATUS.CLOSED,
				TYPE_CODES.SURVEY_TYPE.GRA,
			],
		);

		if (!rows?.length) return null;

		return {
			studentName: rows[0].studentName,
			studentCode: rows[0].studentCode,
			programName: rows[0].programName,
			period: rows[0].period,
			surveys: rows.map(
				(r: {
					token: string;
					courseName: string;
					sectionCode: string;
					completed: boolean;
					surveyType: string;
				}) => ({
					token: r.token,
					courseName: r.courseName,
					sectionCode: r.sectionCode,
					completed: r.completed,
					surveyType: r.surveyType,
				}),
			),
		};
	}

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
				st.first_name || ' ' || st.last_name    AS "studentName",
				st.code                                 AS "studentCode",
				st.email                                AS "studentEmail",
				sse.course_section_id                  AS "courseSectionId",
				c.name->>'es'                          AS "courseName",
				cs.campus_id                           AS "campusId",
				sp.program_id                          AS "programId",
				p.name->>'es'                          AS "programName"
			FROM academic.student_section_enrollments sse
			INNER JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
			INNER JOIN academic.students st ON st.id = es.student_id
			INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			INNER JOIN academic.courses c ON c.id = cs.course_id
			INNER JOIN academic.study_plan_academic_periods spap ON spap.id = es.study_plan_academic_period_id
			INNER JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			INNER JOIN academic.programs p ON p.id = sp.program_id
			WHERE sse.course_section_id = ANY($1)
			ORDER BY "studentName" ASC`,
			[courseSectionIds],
		);
		return rows ?? [];
	}

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
				st.first_name || ' ' || st.last_name AS "studentName",
				st.code                             AS "studentCode",
				st.email                            AS "studentEmail",
				c.name->>'es'                       AS "courseName",
				p.name->>'es'                       AS "programName"
			FROM survey.notifications n
			INNER JOIN evidence.surveys s ON s.id = n.survey_id
			INNER JOIN academic.students st ON st.id = s.student_id
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

	async markAsSentBySurveyId(surveyId: number, sentStatusId: number): Promise<void> {
		await this.dataSource.query(
			`UPDATE survey.notifications
			 SET notification_status_type_id = $1, sent_date = NOW(), updated_at = NOW()
			 WHERE survey_id = $2`,
			[sentStatusId, surveyId],
		);
	}

	async existsForSurvey(surveyId: number): Promise<boolean> {
		const count = await this.repository.count({ where: { surveyId: surveyId } });
		return count > 0;
	}

	/**
	 * Creates (or reuses) the LCFC survey + notification for each candidate in one transaction.
	 * Students whose survey is already closed are skipped entirely. On resend, the latest
	 * existing notification is reset to scheduled and its deadline refreshed. Returns the list
	 * of notifications still pending an email plus create/skip counters.
	 */
	async processSendNotifications(params: {
		lcfcSurveyTypeId: number;
		activeStatusId: number;
		closedStatusId: number;
		scheduledStatusId: number;
		resend: boolean;
		academicPeriodId: number;
		maxRegisterDate: string | null;
		candidates: LcfcSendCandidate[];
	}): Promise<{
		surveysCreated: number;
		alreadyExisted: number;
		pendingNotifications: LcfcPendingNotification[];
	}> {
		const {
			lcfcSurveyTypeId,
			activeStatusId,
			closedStatusId,
			scheduledStatusId,
			resend,
			academicPeriodId,
			maxRegisterDate,
			candidates,
		} = params;

		let surveysCreated = 0;
		let alreadyExisted = 0;
		const pendingNotifications: LcfcPendingNotification[] = [];

		await this.dataSource.transaction(async (manager) => {
			for (const candidate of candidates) {
				const existingSurveyRows: { id: number; surveyStatusTypeId: number }[] =
					await manager.query(
						`SELECT id AS "id", survey_status_type_id AS "surveyStatusTypeId"
						 FROM evidence.surveys
						 WHERE survey_type_id = $1 AND student_id = $2 AND course_section_id = $3
						 LIMIT 1`,
						[lcfcSurveyTypeId, candidate.studentId, candidate.courseSectionId],
					);
				const existingSurvey = existingSurveyRows?.[0] ?? null;

				if (existingSurvey) {
					alreadyExisted++;
					// Never (re)send to a student who already completed this survey — even on resend.
					if (existingSurvey.surveyStatusTypeId === closedStatusId) {
						continue;
					}
					// Default behaviour only (re)sends notifications still scheduled (never sent), so
					// pressing "send" twice does not spam students. On resend we reuse the latest
					// existing notification regardless of status and refresh its deadline.
					const existingNotif: { id: number; token: string }[] = resend
						? await manager.query(
								`SELECT id, token FROM survey.notifications WHERE survey_id = $1 ORDER BY id DESC LIMIT 1`,
								[existingSurvey.id],
							)
						: await manager.query(
								`SELECT id, token FROM survey.notifications WHERE survey_id = $1 AND notification_status_type_id = $2 LIMIT 1`,
								[existingSurvey.id, scheduledStatusId],
							);

					if (existingNotif?.[0]) {
						if (resend) {
							// Reset to scheduled and refresh the deadline so the reused token is valid again.
							// sent_date / max_register_date are NOT NULL, so keep the existing deadline when
							// no new one was resolved, and never null out sent_date (it's re-stamped to
							// NOW() by markAsSentBySurveyId once the email goes out).
							await manager.query(
								`UPDATE survey.notifications
								 SET notification_status_type_id = $1,
								     max_register_date = COALESCE($2, max_register_date),
								     updated_at = NOW()
								 WHERE id = $3`,
								[scheduledStatusId, maxRegisterDate, existingNotif[0].id],
							);
						}
						pendingNotifications.push({
							studentId: candidate.studentId,
							studentName: candidate.studentName,
							studentCode: candidate.studentCode,
							studentEmail: candidate.studentEmail,
							surveyId: existingSurvey.id,
							token: existingNotif[0].token,
							courseName: candidate.courseName,
							programName: candidate.programName,
						});
					}
				} else {
					const inserted: { id: number }[] = await manager.query(
						`INSERT INTO evidence.surveys
						 (survey_type_id, survey_status_type_id, student_id, academic_period_id, campus_id, program_id, course_section_id)
						 VALUES ($1, $2, $3, $4, $5, $6, $7)
						 RETURNING id`,
						[
							lcfcSurveyTypeId,
							activeStatusId,
							candidate.studentId,
							academicPeriodId,
							candidate.campusId,
							candidate.programId,
							candidate.courseSectionId,
						],
					);

					const surveyId = inserted[0].id;
					const token = uuidv4();

					// max_register_date is NOT NULL; fall back to the column default when no deadline is
					// configured yet (it can be set later from Configuration).
					await manager.query(
						`INSERT INTO survey.notifications (survey_id, notification_status_type_id, token, max_register_date)
						 VALUES ($1, $2, $3, COALESCE($4, NOW()))`,
						[surveyId, scheduledStatusId, token, maxRegisterDate],
					);

					surveysCreated++;
					pendingNotifications.push({
						studentId: candidate.studentId,
						studentName: candidate.studentName,
						studentCode: candidate.studentCode,
						studentEmail: candidate.studentEmail,
						surveyId,
						token,
						courseName: candidate.courseName,
						programName: candidate.programName,
					});
				}
			}
		});

		return { surveysCreated, alreadyExisted, pendingNotifications };
	}

	/**
	 * Upserts the outcome scores for a survey and marks it closed, optionally merging a
	 * general comment into evidence.surveys.information — all in one transaction.
	 */
	async saveScoresAndCloseSurvey(
		surveyId: number,
		closedStatusId: number,
		scores: LcfcScoreItem[],
		generalComment?: string,
	): Promise<void> {
		await this.dataSource.transaction(async (manager: EntityManager) => {
			for (const item of scores) {
				const existing: { id: number }[] = await manager.query(
					`SELECT id FROM survey.scores WHERE survey_id = $1 AND outcome_id = $2 LIMIT 1`,
					[surveyId, item.outcomeId],
				);

				if (existing?.length > 0) {
					await manager.query(
						`UPDATE survey.scores SET score = $1, commentaries = $2, updated_at = NOW() WHERE survey_id = $3 AND outcome_id = $4`,
						[item.score, item.commentaries, surveyId, item.outcomeId],
					);
				} else {
					await manager.query(
						`INSERT INTO survey.scores (survey_id, outcome_id, score, commentaries) VALUES ($1, $2, $3, $4)`,
						[surveyId, item.outcomeId, item.score, item.commentaries],
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
