import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';

export const LCFC_SURVEY_TYPE = 'LCFC';

@Injectable()
export class LcfcConfigRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(OutcomeConfigEntity)
		repository: Repository<OutcomeConfigEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findAllLcfc(filters?: { program_id?: number; academic_period_id?: number; is_active?: boolean }): Promise<OutcomeConfigEntity[]> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			const qb = repository.createQueryBuilder('oc').where(`oc.extra->>'survey_type' = :type`, { type: LCFC_SURVEY_TYPE });

			if (filters?.program_id !== undefined) {
				qb.andWhere(`(oc.extra->>'program_id')::int = :programId`, { programId: filters.program_id });
			}
			if (filters?.academic_period_id !== undefined) {
				qb.andWhere(`(oc.extra->>'academic_period_id')::int = :periodId`, { periodId: filters.academic_period_id });
			}
			if (filters?.is_active !== undefined) {
				qb.andWhere('oc.is_active = :isActive', { isActive: filters.is_active });
			}

			qb.orderBy('oc.user_outcome_name', 'ASC');
			return await qb.getMany();
		} finally {
			await queryRunner.release();
		}
	}

	async findByCourseSection(courseSectionId: number, academicPeriodId: number): Promise<OutcomeConfigEntity | null> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository
				.createQueryBuilder('oc')
				.where(`oc.extra->>'survey_type' = :type`, { type: LCFC_SURVEY_TYPE })
				.andWhere(`(oc.extra->>'course_section_id')::int = :csId`, { csId: courseSectionId })
				.andWhere(`(oc.extra->>'academic_period_id')::int = :periodId`, { periodId: academicPeriodId })
				.getOne();
		} finally {
			await queryRunner.release();
		}
	}

	/** Gets first valid outcome_id for a program (required to satisfy FK constraint in outcome_configs) */
	async findFirstProgramOutcomeId(programId: number): Promise<number | null> {
		const { queryRunner } = await this.getRepository();
		try {
			const rows = await queryRunner.manager.query(
				`SELECT o.id
				 FROM accreditation.outcomes o
				 INNER JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
				 WHERE pc.program_id = $1
				 ORDER BY o.id ASC
				 LIMIT 1`,
				[programId],
			);
			return rows?.[0]?.id ?? null;
		} finally {
			await queryRunner.release();
		}
	}

	/** Gets all course sections for an academic period, filtered by program and/or campus */
	async getCourseSectionsForPeriod(
		academicPeriodId: number,
		programId?: number,
		campusId?: number,
	): Promise<{ course_section_id: number; course_id: number; course_name: string; section_code: string; campus_id: number }[]> {
		const { queryRunner } = await this.getRepository();
		try {
			let query = `
				SELECT
					cs.id           AS course_section_id,
					c.id            AS course_id,
					c.name          AS course_name,
					cs.section_code,
					cs.campus_id
				FROM academic.course_sections cs
				INNER JOIN academic.study_plan_courses spc ON spc.id = cs.study_plan_course_id
				INNER JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
				INNER JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
				INNER JOIN academic.courses c ON c.id = spc.course_id
				WHERE spap.academic_period_id = $1
			`;
			const params: any[] = [academicPeriodId];

			if (programId) {
				query += ` AND sp.program_id = $${params.length + 1}`;
				params.push(programId);
			}
			if (campusId) {
				query += ` AND cs.campus_id = $${params.length + 1}`;
				params.push(campusId);
			}

			query += ` ORDER BY c.name ASC, cs.section_code ASC`;

			return await queryRunner.manager.query(query, params);
		} finally {
			await queryRunner.release();
		}
	}
}
