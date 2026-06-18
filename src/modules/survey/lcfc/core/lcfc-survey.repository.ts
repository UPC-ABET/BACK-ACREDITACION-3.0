import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

@Injectable()
export class LcfcSurveyRepository extends BaseRepository<SurveyEntity> {
	constructor(
		@InjectRepository(SurveyEntity)
		repository: Repository<SurveyEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getLcfcSurveyTypeId(code = TYPE_CODES.SURVEY_TYPE.LCFC): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	async getActiveSurveyStatusId(code = 'TG602-T001'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	async getClosedSurveyStatusId(code = 'TG602-T002'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	async getScheduledNotificationStatusId(code = 'TG1001-T001'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	async getSentNotificationStatusId(code = 'TG1001-T002'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	async findExistingLcfcSurvey(
		lcfcSurveyTypeId: number,
		studentId: number,
		courseSectionId: number,
	): Promise<SurveyEntity | null> {
		return await this.repository
			.createQueryBuilder('s')
			.where('s.survey_type_id = :typeId', { typeId: lcfcSurveyTypeId })
			.andWhere('s.student_id = :studentId', { studentId })
			.andWhere('s.course_section_id = :csId', { csId: courseSectionId })
			.getOne();
	}

	async getOutcomesForCourseSection(
		courseSectionId: number,
		programId?: number,
		commissionId?: number | null,
	): Promise<
		{
			outcomeId: number;
			name: string;
			code: string;
			description: string | null;
			commissionId: number;
			commissionName: string;
		}[]
	> {
		// Filter outcomes by the student's own program AND (when the config specifies one)
		// the commission selected in the LCFC config. This ensures each survey shows only
		// the outcomes relevant to the student's career and the configured commission.
		// The DISTINCT set is wrapped so we can sort by the Spanish commission name: an
		// expression like cm.name->>'es' is not allowed in ORDER BY alongside SELECT DISTINCT
		// unless it is part of the select list, so we order in the outer query instead.
		const rows = await this.dataSource.query(
			`SELECT "outcomeId", "name", "code", "description", "commissionId", "commissionName"
			FROM (
				SELECT DISTINCT
					o.id                   AS "outcomeId",
					o.outcome_name         AS "name",
					o.outcome_code         AS "code",
					o.outcome_description  AS "description",
					pc.commission_id       AS "commissionId",
					cm.name                AS "commissionName"
				FROM accreditation.outcomes o
				INNER JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
				INNER JOIN accreditation.commissions cm ON cm.id = pc.commission_id
				INNER JOIN academic.course_outcome_mappings com ON com.outcome_id = o.id
				INNER JOIN academic.study_plan_courses spc ON spc.id = com.study_plan_course_id
				INNER JOIN academic.course_sections cs ON cs.course_id = spc.course_id
				WHERE cs.id = $1
				  AND ($2::int IS NULL OR pc.program_id = $2)
				  AND ($3::int IS NULL OR pc.commission_id = $3)
			) t
			ORDER BY t."commissionName"->>'es' ASC, t."code" ASC`,
			[courseSectionId, programId ?? null, commissionId ?? null],
		);
		return rows ?? [];
	}

	/** Rows of completed LCFC surveys with their outcome scores, for the Excel export.
	 *  The survey-level general comment (evidence.surveys.information) is repeated in each
	 *  outcome row so the Excel file shows it alongside every score for that student/course. */
	async getCompletedSurveysForExport(
		academicPeriodId: number,
		programId?: number,
	): Promise<
		{
			studentCode: string;
			studentName: string;
			programName: string;
			courseName: string;
			sectionCode: string;
			outcomeCode: string;
			outcomeName: string;
			score: number;
			generalComment: string | null;
			completedAt: string;
		}[]
	> {
		const rows = await this.dataSource.query(
			`SELECT
				st.code                              AS "studentCode",
				st.first_name || ' ' || st.last_name AS "studentName",
				p.name->>'es'                        AS "programName",
				c.name->>'es'                        AS "courseName",
				cs.section_code                      AS "sectionCode",
				o.outcome_code                       AS "outcomeCode",
				o.outcome_name->>'es'                AS "outcomeName",
				sc.score                             AS "score",
				s.information->>'commentaries'       AS "generalComment",
				s.updated_at                         AS "completedAt"
			FROM evidence.surveys s
			INNER JOIN survey.scores sc ON sc.survey_id = s.id
			INNER JOIN accreditation.outcomes o ON o.id = sc.outcome_id
			INNER JOIN academic.students st ON st.id = s.student_id
			INNER JOIN academic.programs p ON p.id = s.program_id
			LEFT JOIN academic.course_sections cs ON cs.id = s.course_section_id
			LEFT JOIN academic.courses c ON c.id = cs.course_id
			WHERE s.survey_type_id = (SELECT id FROM core.types WHERE code = $1)
			  AND s.academic_period_id = $2
			  AND ($3::int IS NULL OR s.program_id = $3)
			ORDER BY st.code ASC, c.name->>'es' ASC, o.outcome_code ASC`,
			[TYPE_CODES.SURVEY_TYPE.LCFC, academicPeriodId, programId ?? null],
		);
		return rows ?? [];
	}

	async getDashboardData(
		lcfcSurveyTypeId: number,
		activeStatusId: number,
		closedStatusId: number,
		filters: { academicPeriodId?: number; programId?: number; campusId?: number },
	): Promise<{ completed: number; pending: number; total: number; byCourse: any[] }> {
		let whereClause = `s.survey_type_id = $1`;
		const params: any[] = [lcfcSurveyTypeId];

		if (filters.academicPeriodId) {
			whereClause += ` AND s.academic_period_id = $${params.length + 1}`;
			params.push(filters.academicPeriodId);
		}
		if (filters.programId) {
			whereClause += ` AND s.program_id = $${params.length + 1}`;
			params.push(filters.programId);
		}
		if (filters.campusId) {
			whereClause += ` AND s.campus_id = $${params.length + 1}`;
			params.push(filters.campusId);
		}

		const [summary, byCourse] = await Promise.all([
			this.dataSource.query(
				`SELECT
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 1})::int AS "completed",
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 2})::int AS "pending",
					COUNT(*)::int AS "total"
				FROM evidence.surveys s
				WHERE ${whereClause}`,
				[...params, closedStatusId, activeStatusId],
			),
			this.dataSource.query(
				`SELECT
					c.name                                                                              AS "courseName",
					cs.section_code                                                                     AS "sectionCode",
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 1})::int       AS "completed",
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 2})::int       AS "pending",
					COUNT(*)::int                                                                       AS "total"
				FROM evidence.surveys s
				INNER JOIN academic.course_sections cs ON cs.id = s.course_section_id
				INNER JOIN academic.courses c ON c.id = cs.course_id
				WHERE ${whereClause}
				GROUP BY c.name, cs.section_code
				ORDER BY c.name ASC, cs.section_code ASC`,
				[...params, closedStatusId, activeStatusId],
			),
		]);

		return {
			completed: summary[0]?.completed ?? 0,
			pending: summary[0]?.pending ?? 0,
			total: summary[0]?.total ?? 0,
			byCourse,
		};
	}
}
