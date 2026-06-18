import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
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
			// Show configs where either:
			// 1. The config's extra.program_id matches, OR
			// 2. The config's course section belongs to the program's non-elective study plan
			qb.andWhere(
				new Brackets((qb2) => {
					qb2.where(`(oc.extra->>'program_id')::int = :programId`, { programId: filters.programId })
						.orWhere(`EXISTS (
							SELECT 1
							FROM academic.course_sections cs
							INNER JOIN academic.courses c ON c.id = cs.course_id
							INNER JOIN academic.study_plan_courses spc ON spc.course_id = c.id
							INNER JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
							INNER JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
							WHERE cs.id = (oc.extra->>'course_section_id')::int
							  AND sp.program_id = :programId
							  AND spc.is_elective = false
							  AND sp.is_active = true
							  AND spap.is_active = true
							  AND spc.is_active = true
						)`);
				}),
			);
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

	/**
	 * Returns the academic period immediately before targetPeriodId (same modality, ordered by
	 * start_date DESC). Used when cloning without an explicit sourceAcademicPeriodId.
	 */
	async findPreviousAcademicPeriodId(targetPeriodId: number): Promise<number | null> {
		const rows = await this.dataSource.query(
			`SELECT id
			 FROM academic.academic_periods
			 WHERE modality_type_id = (
				 SELECT modality_type_id FROM academic.academic_periods WHERE id = $1
			 )
			   AND start_date < (
				 SELECT start_date FROM academic.academic_periods WHERE id = $1
			 )
			 ORDER BY start_date DESC
			 LIMIT 1`,
			[targetPeriodId],
		);
		return rows?.[0]?.id ?? null;
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

	/** Outcomes mapped to a course section, scoped to one program (for the edit modal). */
	async getSectionOutcomes(
		courseSectionId: number,
		programId: number,
	): Promise<{ outcomeId: number; code: string; name: unknown }[]> {
		return await this.dataSource.query(
			`SELECT DISTINCT
				o.id           AS "outcomeId",
				o.outcome_code AS "code",
				o.outcome_name AS "name"
			FROM accreditation.outcomes o
			INNER JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			INNER JOIN academic.course_outcome_mappings com ON com.outcome_id = o.id
			INNER JOIN academic.study_plan_courses spc ON spc.id = com.study_plan_course_id
			INNER JOIN academic.course_sections cs ON cs.course_id = spc.course_id
			WHERE cs.id = $1 AND pc.program_id = $2
			ORDER BY o.outcome_code ASC`,
			[courseSectionId, programId],
		);
	}

	/** Gets first valid outcome_id for a program (or any program when null) — needed to satisfy the FK constraint in outcome_configs. */
	async findFirstProgramOutcomeId(programId?: number | null): Promise<number | null> {
		const rows = await this.dataSource.query(
			`SELECT o.id
			 FROM accreditation.outcomes o
			 INNER JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			 WHERE ($1::int IS NULL OR pc.program_id = $1)
			 ORDER BY o.id ASC
			 LIMIT 1`,
			[programId ?? null],
		);
		return rows?.[0]?.id ?? null;
	}

	/**
	 * Returns all non-elective course sections for an academic period.
	 * When programId is provided, restricts to sections in that program's active study plan.
	 * When programId is omitted, returns ALL active sections for the period.
	 */
	async getCourseSectionsForPeriod(
		academicPeriodId: number,
		programId?: number | null,
	): Promise<
		{
			courseSectionId: number;
			courseId: number;
			courseName: string;
			sectionCode: string;
			campusId: number;
		}[]
	> {
		return await this.dataSource.query(
			`SELECT
				cs.id           AS "courseSectionId",
				c.id            AS "courseId",
				c.name          AS "courseName",
				cs.section_code AS "sectionCode",
				cs.campus_id    AS "campusId"
			FROM academic.course_sections cs
			INNER JOIN academic.courses c ON c.id = cs.course_id
			WHERE cs.academic_period_id = $1
			  AND c.is_active = true
			  AND ($2::int IS NULL OR EXISTS (
				  SELECT 1
				  FROM academic.study_plans sp
				  INNER JOIN academic.study_plan_academic_periods spap ON spap.study_plan_id = sp.id
				  INNER JOIN academic.study_plan_courses spc ON spc.study_plan_academic_period_id = spap.id
				  WHERE spc.course_id = cs.course_id
				    AND spap.academic_period_id = $1
				    AND sp.program_id = $2
				    AND spc.is_elective = false
				    AND sp.is_active = true
				    AND spap.is_active = true
				    AND spc.is_active = true
			  ))
			ORDER BY c.name ASC, cs.section_code ASC`,
			[academicPeriodId, programId ?? null],
		);
	}

	/** Returns all commissions linked to a course section via course-outcome mappings. */
	async getSectionCommissions(
		courseSectionId: number,
		programId?: number | null,
	): Promise<{ commissionId: number; code: string; name: unknown }[]> {
		// The DISTINCT set is wrapped so we can sort by the Spanish commission name: an
		// expression like cm.name->>'es' is not allowed in ORDER BY alongside SELECT DISTINCT
		// unless it is part of the select list, so we order in the outer query instead.
		return await this.dataSource.query(
			`SELECT "commissionId", "code", "name"
			FROM (
				SELECT DISTINCT
					pc.commission_id AS "commissionId",
					cm.code          AS "code",
					cm.name          AS "name"
				FROM accreditation.program_commissions pc
				INNER JOIN accreditation.commissions cm ON cm.id = pc.commission_id
				INNER JOIN accreditation.outcomes o ON o.program_commission_id = pc.id
				INNER JOIN academic.course_outcome_mappings com ON com.outcome_id = o.id
				INNER JOIN academic.study_plan_courses spc ON spc.id = com.study_plan_course_id
				INNER JOIN academic.course_sections cs ON cs.course_id = spc.course_id
				WHERE cs.id = $1
				  AND ($2::int IS NULL OR pc.program_id = $2)
			) t
			ORDER BY t."name"->>'es' ASC`,
			[courseSectionId, programId ?? null],
		);
	}

	async setDeadline(
		programId: number | null | undefined,
		academicPeriodId: number,
		maxRegisterDate: string,
	): Promise<{ updatedConfigs: number; updatedNotifications: number }> {
		return await this.dataSource.transaction(async (manager) => {
			const cfgResult = await manager.query(
				`UPDATE survey.outcome_configs
				 SET extra = jsonb_set(COALESCE(extra, '{}'::jsonb), '{max_register_date}', to_jsonb($3::text)),
				     updated_at = NOW()
				 WHERE extra->>'survey_type' = $4
				   AND (extra->>'academic_period_id')::int = $2
				   AND ($1::int IS NULL OR (extra->>'program_id')::int = $1)`,
				[programId ?? null, academicPeriodId, maxRegisterDate, LCFC_SURVEY_TYPE],
			);

			const notifResult = await manager.query(
				`UPDATE survey.notifications n
				 SET max_register_date = $3, updated_at = NOW()
				 FROM evidence.surveys s
				 WHERE s.id = n.survey_id
				   AND s.survey_type_id = (SELECT id FROM core.types WHERE code = $5)
				   AND s.academic_period_id = $2
				   AND s.course_section_id IN (
				     SELECT (oc.extra->>'course_section_id')::int
				     FROM survey.outcome_configs oc
				     WHERE oc.extra->>'survey_type' = $4
				       AND (oc.extra->>'academic_period_id')::int = $2
				       AND ($1::int IS NULL OR (oc.extra->>'program_id')::int = $1)
				   )`,
				[
					programId ?? null,
					academicPeriodId,
					maxRegisterDate,
					LCFC_SURVEY_TYPE,
					TYPE_CODES.SURVEY_TYPE.LCFC,
				],
			);

			return {
				updatedConfigs: cfgResult?.[1] ?? 0,
				updatedNotifications: notifResult?.[1] ?? 0,
			};
		});
	}

	/** Returns the stored survey deadline for a program/period, if any. */
	async getDeadline(
		programId: number | null | undefined,
		academicPeriodId: number,
	): Promise<string | null> {
		const rows = await this.dataSource.query(
			`SELECT extra->>'max_register_date' AS "maxRegisterDate"
			 FROM survey.outcome_configs
			 WHERE extra->>'survey_type' = $3
			   AND (extra->>'academic_period_id')::int = $2
			   AND ($1::int IS NULL OR (extra->>'program_id')::int = $1)
			   AND extra->>'max_register_date' IS NOT NULL
			 LIMIT 1`,
			[programId ?? null, academicPeriodId, LCFC_SURVEY_TYPE],
		);
		return rows?.[0]?.maxRegisterDate ?? null;
	}
}
