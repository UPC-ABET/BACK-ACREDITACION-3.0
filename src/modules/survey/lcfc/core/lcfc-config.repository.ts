import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

export const LCFC_SURVEY_TYPE = 'LCFC';

@Injectable()
export class LcfcConfigRepository extends BaseRepository<OutcomeConfigEntity> {
	constructor(
		@InjectRepository(OutcomeConfigEntity)
		repository: Repository<OutcomeConfigEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findAllLcfc(filters?: {
		programId?: number;
		academicPeriodId?: number;
		isActive?: boolean;
	}): Promise<OutcomeConfigEntity[]> {
		const qb = this.repository
			.createQueryBuilder('oc')
			.where(`oc.extra->>'survey_type' = :type`, { type: LCFC_SURVEY_TYPE });

		if (filters?.programId !== undefined) {
			qb.andWhere(`(oc.extra->>'program_id')::int = :programId`, { programId: filters.programId });
		}
		if (filters?.academicPeriodId !== undefined) {
			qb.andWhere(`(oc.extra->>'academic_period_id')::int = :periodId`, {
				periodId: filters.academicPeriodId,
			});
		}
		if (filters?.isActive !== undefined) {
			qb.andWhere('oc.is_active = :isActive', { isActive: filters.isActive });
		}

		qb.orderBy('oc.user_outcome_name', 'ASC');
		return await qb.getMany();
	}

	async findByCourseSection(
		courseSectionId: number,
		academicPeriodId: number,
	): Promise<OutcomeConfigEntity | null> {
		return await this.repository
			.createQueryBuilder('oc')
			.where(`oc.extra->>'survey_type' = :type`, { type: LCFC_SURVEY_TYPE })
			.andWhere(`(oc.extra->>'course_section_id')::int = :csId`, { csId: courseSectionId })
			.andWhere(`(oc.extra->>'academic_period_id')::int = :periodId`, {
				periodId: academicPeriodId,
			})
			.getOne();
	}

	/** Latest academic period id for a given modality, ordered by start date. */
	async findLatestAcademicPeriodId(modalityTypeId: number): Promise<number | null> {
		const rows = await this.dataSource.query(
			`SELECT id
			 FROM academic.academic_periods
			 WHERE modality_type_id = $1
			 ORDER BY start_date DESC
			 LIMIT 1`,
			[modalityTypeId],
		);
		return rows?.[0]?.id ?? null;
	}

	/** Whether a program belongs to the given school's org chart. */
	async isProgramInSchool(programId: number, schoolId: number): Promise<boolean> {
		const rows = await this.dataSource.query(
			`SELECT 1
			 FROM organization.charts ch_prog
			 INNER JOIN organization.charts ch_sch ON ch_sch.id = ch_prog.root_chart_id
			 WHERE ch_prog.entity_type_id = (SELECT id FROM core.types WHERE code = $1)
			   AND ch_sch.entity_type_id = (SELECT id FROM core.types WHERE code = $2)
			   AND ch_sch.entity_code = $3
			   AND ch_prog.entity_code = $4
			 LIMIT 1`,
			[TYPE_CODES.ENTITY_TYPE.PROGRAM, TYPE_CODES.ENTITY_TYPE.SCHOOL, schoolId, programId],
		);
		return rows.length > 0;
	}

	/** Gets first valid outcome_id for a program (required to satisfy FK constraint in outcome_configs) */
	async findFirstProgramOutcomeId(programId: number): Promise<number | null> {
		const rows = await this.dataSource.query(
			`SELECT o.id
			 FROM accreditation.outcomes o
			 INNER JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			 WHERE pc.program_id = $1
			 ORDER BY o.id ASC
			 LIMIT 1`,
			[programId],
		);
		return rows?.[0]?.id ?? null;
	}

	async getCourseSectionsForPeriod(
		academicPeriodId: number,
		programId?: number,
		campusId?: number,
	): Promise<
		{
			courseSectionId: number;
			courseId: number;
			courseName: string;
			sectionCode: string;
			campusId: number;
		}[]
	> {
		let query = `
			SELECT
				cs.id           AS "courseSectionId",
				c.id            AS "courseId",
				c.name          AS "courseName",
				cs.section_code AS "sectionCode",
				cs.campus_id    AS "campusId"
			FROM academic.course_sections cs
			INNER JOIN academic.courses c ON c.id = cs.course_id
			WHERE cs.academic_period_id = $1
		`;
		const params: any[] = [academicPeriodId];

		if (programId) {
			query += ` AND EXISTS (
				SELECT 1
				FROM academic.study_plans sp
				INNER JOIN academic.study_plan_academic_periods spap ON spap.study_plan_id = sp.id
				INNER JOIN academic.study_plan_courses spc ON spc.study_plan_academic_period_id = spap.id
				WHERE spc.course_id = cs.course_id
				  AND spap.academic_period_id = cs.academic_period_id
				  AND sp.program_id = $${params.length + 1}
			)`;
			params.push(programId);
		}
		if (campusId) {
			query += ` AND cs.campus_id = $${params.length + 1}`;
			params.push(campusId);
		}

		query += ` ORDER BY c.name ASC, cs.section_code ASC`;

		return await this.dataSource.query(query, params);
	}
}
