import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

@Injectable()
export class GraSurveyRepository extends BaseRepository<SurveyEntity> {
	constructor(
		@InjectRepository(SurveyEntity)
		repository: Repository<SurveyEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findExistingGraSurvey(
		graSurveyTypeId: number,
		studentId: number,
		academicPeriodId: number,
		programId: number,
	): Promise<SurveyEntity | null> {
		return await this.repository
			.createQueryBuilder('s')
			.where('s.survey_type_id = :typeId', { typeId: graSurveyTypeId })
			.andWhere('s.student_id = :studentId', { studentId })
			.andWhere('s.academic_period_id = :periodId', { periodId: academicPeriodId })
			.andWhere('s.program_id = :programId', { programId })
			.getOne();
	}

	async getGraSurveyTypeId(code = TYPE_CODES.SURVEY_TYPE.GRA): Promise<number | null> {
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

	async closeSurvey(
		surveyId: number,
		closedStatusId: number,
		commentaries?: string,
	): Promise<void> {
		const infoUpdate = commentaries
			? `, information = COALESCE(information::jsonb, '{}'::jsonb) || jsonb_build_object('commentaries', $3)`
			: '';
		const params: any[] = [closedStatusId, surveyId];
		if (commentaries) params.push(commentaries);

		await this.dataSource.query(
			`UPDATE evidence.surveys
			 SET survey_status_type_id = $1, updated_at = NOW()${infoUpdate}
			 WHERE id = $2`,
			params,
		);
	}

	/** Rows of completed GRA surveys with their outcome scores, for the Excel export. */
	async getCompletedSurveysForExport(
		academicPeriodId: number,
		programId?: number,
	): Promise<
		{
			studentCode: string;
			studentName: string;
			programName: string;
			outcomeCode: string;
			outcomeName: string;
			score: number;
			commentaries: unknown;
			completedAt: string;
		}[]
	> {
		const rows = await this.dataSource.query(
			`SELECT
				st.code                              AS "studentCode",
				st.first_name || ' ' || st.last_name AS "studentName",
				p.name->>'es'                        AS "programName",
				o.outcome_code                       AS "outcomeCode",
				o.outcome_name->>'es'                AS "outcomeName",
				sc.score                             AS "score",
				sc.commentaries                      AS "commentaries",
				s.updated_at                         AS "completedAt"
			FROM evidence.surveys s
			INNER JOIN survey.scores sc ON sc.survey_id = s.id
			INNER JOIN accreditation.outcomes o ON o.id = sc.outcome_id
			INNER JOIN academic.students st ON st.id = s.student_id
			INNER JOIN academic.programs p ON p.id = s.program_id
			WHERE s.survey_type_id = (SELECT id FROM core.types WHERE code = $1)
			  AND s.academic_period_id = $2
			  AND ($3::int IS NULL OR s.program_id = $3)
			ORDER BY st.code ASC, o.outcome_code ASC`,
			[TYPE_CODES.SURVEY_TYPE.GRA, academicPeriodId, programId ?? null],
		);
		return rows ?? [];
	}

	async getDashboardData(
		graSurveyTypeId: number,
		activeStatusId: number,
		closedStatusId: number,
		filters: { academicPeriodId?: number; programId?: number; campusId?: number },
	): Promise<{ completed: number; pending: number; total: number; byProgram: any[] }> {
		let whereClause = `s.survey_type_id = $1`;
		const params: any[] = [graSurveyTypeId];

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

		const [summary, byProgram] = await Promise.all([
			this.dataSource.query(
				`SELECT
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 1})::int AS completed,
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 2})::int AS pending,
					COUNT(*)::int AS total
				FROM evidence.surveys s
				WHERE ${whereClause}`,
				[...params, closedStatusId, activeStatusId],
			),
			this.dataSource.query(
				`SELECT
					p.name AS "programName",
					p.code AS "programCode",
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 1})::int AS "completed",
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 2})::int AS "pending",
					COUNT(*)::int AS "total"
				FROM evidence.surveys s
				INNER JOIN academic.programs p ON p.id = s.program_id
				WHERE ${whereClause}
				GROUP BY p.id, p.name, p.code
				ORDER BY p.name`,
				[...params, closedStatusId, activeStatusId],
			),
		]);

		return {
			completed: summary[0]?.completed ?? 0,
			pending: summary[0]?.pending ?? 0,
			total: summary[0]?.total ?? 0,
			byProgram,
		};
	}

	async getDefaultCourseSectionId(): Promise<number | null> {
		const rows = await this.dataSource.query(
			`SELECT id FROM academic.course_sections ORDER BY id LIMIT 1`,
		);
		return rows?.[0]?.id ?? null;
	}

	async findStudentByCode(code: string): Promise<{ id: number } | null> {
		const rows = await this.dataSource.query(
			`SELECT id FROM academic.students WHERE code = $1 LIMIT 1`,
			[code],
		);
		return rows?.[0] ?? null;
	}

	async findStudentsByCodes(codes: string[]): Promise<{ id: number; code: string }[]> {
		if (codes.length === 0) return [];
		return await this.dataSource.query(
			`SELECT id, code FROM academic.students WHERE code = ANY($1)`,
			[codes],
		);
	}

	/** Search active students by partial code or name match (first/last name), for the
	 *  "add individual student" GRA search box. Scoped to this module — does not touch the
	 *  shared academic/students module. */
	async searchStudentsByCodeOrName(
		term: string,
		limit: number,
	): Promise<
		{
			id: number;
			code: string;
			firstName: string;
			lastName: string;
			email: string | null;
			programName: string | null;
		}[]
	> {
		const like = `%${term}%`;
		return await this.dataSource.query(
			`SELECT
				st.id                AS "id",
				st.code              AS "code",
				st.first_name        AS "firstName",
				st.last_name         AS "lastName",
				st.email             AS "email",
				p.name->>'es'        AS "programName"
			FROM academic.students st
			LEFT JOIN academic.programs p ON p.id = st.program_id
			WHERE st.is_active = true
			  AND (st.code ILIKE $1 OR st.first_name ILIKE $1 OR st.last_name ILIKE $1)
			ORDER BY st.first_name ASC
			LIMIT $2`,
			[like, limit],
		);
	}

	/** Resolves a campus id for a student. Tries their enrolled campus first, then falls back to any campus. */
	async resolveDefaultCampus(studentId?: number): Promise<number | null> {
		if (studentId) {
			const enrolled = await this.dataSource.query(
				`SELECT es.campus_id AS "campusId" FROM academic.enrolled_students es WHERE es.student_id = $1 ORDER BY es.id DESC LIMIT 1`,
				[studentId],
			);
			if (enrolled?.[0]?.campusId) return Number(enrolled[0].campusId);
		}
		const campus = await this.dataSource.query(
			`SELECT id FROM organization.campuses WHERE is_active = true ORDER BY id LIMIT 1`,
		);
		return campus?.[0]?.id ?? null;
	}
}
