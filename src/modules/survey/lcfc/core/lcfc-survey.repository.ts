import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';

@Injectable()
export class LcfcSurveyRepository extends BaseRepository<SurveyEntity> {
	constructor(
		@InjectRepository(SurveyEntity)
		repository: Repository<SurveyEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getLcfcSurveyTypeId(code = 'TG601-T004'): Promise<number | null> {
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
	): Promise<{ outcomeId: number; name: string; code: string; description: string | null }[]> {
		const rows = await this.dataSource.query(
			`SELECT DISTINCT
				o.id                   AS "outcomeId",
				o.outcome_name         AS "name",
				o.outcome_code         AS "code",
				o.outcome_description  AS "description"
			FROM accreditation.outcomes o
			INNER JOIN academic.course_outcome_mappings com ON com.outcome_id = o.id
			INNER JOIN academic.study_plan_courses spc ON spc.id = com.study_plan_course_id
			INNER JOIN academic.course_sections cs ON cs.study_plan_course_id = spc.id
			WHERE cs.id = $1
			ORDER BY o.outcome_code ASC`,
			[courseSectionId],
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
				INNER JOIN academic.study_plan_courses spc ON spc.id = cs.study_plan_course_id
				INNER JOIN academic.courses c ON c.id = spc.course_id
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
