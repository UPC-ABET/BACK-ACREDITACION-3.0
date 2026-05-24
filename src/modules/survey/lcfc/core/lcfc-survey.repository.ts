import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';

@Injectable()
export class LcfcSurveyRepository extends BaseRepostitory {
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

	/** Finds an existing LCFC survey for a student in a specific course section */
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

	/** Gets outcomes mapped to a course section via course_outcome_mappings */
	async getOutcomesForCourseSection(
		courseSectionId: number,
	): Promise<{ outcome_id: number; name: string; code: string; description: string | null }[]> {
		const rows = await this.dataSource.query(
			`SELECT DISTINCT
				o.id                   AS outcome_id,
				o.outcome_name         AS name,
				o.outcome_code         AS code,
				o.outcome_description  AS description
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

	/** Dashboard: counts LCFC surveys by status, grouped by course */
	async getDashboardData(
		lcfcSurveyTypeId: number,
		activeStatusId: number,
		closedStatusId: number,
		filters: { academic_period_id?: number; program_id?: number; campus_id?: number },
	): Promise<{ completed: number; pending: number; total: number; by_course: any[] }> {
		let whereClause = `s.survey_type_id = $1`;
		const params: any[] = [lcfcSurveyTypeId];

		if (filters.academic_period_id) {
			whereClause += ` AND s.academic_period_id = $${params.length + 1}`;
			params.push(filters.academic_period_id);
		}
		if (filters.program_id) {
			whereClause += ` AND s.program_id = $${params.length + 1}`;
			params.push(filters.program_id);
		}
		if (filters.campus_id) {
			whereClause += ` AND s.campus_id = $${params.length + 1}`;
			params.push(filters.campus_id);
		}

		const [summary, byCourse] = await Promise.all([
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
					c.name                                                                              AS course_name,
					cs.section_code,
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 1})::int       AS completed,
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 2})::int       AS pending,
					COUNT(*)::int                                                                       AS total
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
			by_course: byCourse,
		};
	}
}
