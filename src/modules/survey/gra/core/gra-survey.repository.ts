import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';

@Injectable()
export class GraSurveyRepository extends BaseRepository<SurveyEntity> {
	constructor(
		@InjectRepository(SurveyEntity)
		repository: Repository<SurveyEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	/** Finds an existing GRA survey for a student in a given period and program */
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

	/** Returns the type_id for the GRA survey type from core.types */
	async getGraSurveyTypeId(code = 'TG601-T002'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	/** Returns the type_id for the active survey status */
	async getActiveSurveyStatusId(code = 'TG602-T001'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	/** Returns the type_id for the closed survey status */
	async getClosedSurveyStatusId(code = 'TG602-T002'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	/** Returns the type_id for the scheduled notification status */
	async getScheduledNotificationStatusId(code = 'TG1001-T001'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	/** Returns the type_id for the sent notification status */
	async getSentNotificationStatusId(code = 'TG1001-T002'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	/** Updates the survey status to closed */
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

	/** Dashboard: counts completed vs pending GRA surveys */
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

	/** Returns the default course_section_id (required as FK) */
	async getDefaultCourseSectionId(): Promise<number | null> {
		const rows = await this.dataSource.query(
			`SELECT id FROM academic.course_sections ORDER BY id LIMIT 1`,
		);
		return rows?.[0]?.id ?? 1;
	}
}
