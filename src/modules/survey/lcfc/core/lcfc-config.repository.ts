import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, DeleteResult, Repository } from 'typeorm';
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

	/** Base LCFC query with the shared program/period/status filters applied. */
	private buildLcfcQuery(filters?: {
		programId?: number;
		academicPeriodId?: number;
		isActive?: boolean;
	}) {
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
		return qb;
	}

	async findAllLcfc(filters?: {
		programId?: number;
		academicPeriodId?: number;
		isActive?: boolean;
	}): Promise<OutcomeConfigEntity[]> {
		return await this.buildLcfcQuery(filters).getMany();
	}

	/** Lean projection for list views: only the columns the section table needs, skipping the
	 *  heavy jsonb payload (descriptions, full extra) that made the full list ~1 MB per period.
	 *  Rows without a course section are excluded — they can't be listed nor resent to. */
	async findSectionSummariesLcfc(filters?: {
		programId?: number;
		academicPeriodId?: number;
		isActive?: boolean;
		search?: string;
		skip?: number;
		take?: number;
	}): Promise<{
		rows: {
			id: number;
			courseName: unknown;
			sectionCode: string | null;
			courseSectionId: number | null;
			isActive: boolean;
		}[];
		total: number;
	}> {
		const qb = this.buildLcfcQuery(filters).andWhere(`oc.extra->>'course_section_id' IS NOT NULL`);

		if (filters?.search?.trim()) {
			// course_name may be an I18nText object or a bare string; casting the jsonb to text
			// keeps the match simple and covers both shapes.
			qb.andWhere(
				new Brackets((qb2) => {
					qb2
						.where(`COALESCE(oc.extra->'course_name', oc.user_outcome_name)::text ILIKE :search`)
						.orWhere(`oc.extra->>'section_code' ILIKE :search`);
				}),
			).setParameter('search', `%${filters.search.trim()}%`);
		}

		const total = await qb.getCount();
		const rows = await qb
			.select('oc.id', 'id')
			.addSelect(`COALESCE(oc.extra->'course_name', oc.user_outcome_name)`, 'courseName')
			.addSelect(`oc.extra->>'section_code'`, 'sectionCode')
			.addSelect(`(oc.extra->>'course_section_id')::int`, 'courseSectionId')
			.addSelect('oc.is_active', 'isActive')
			.offset(filters?.skip)
			.limit(filters?.take)
			.getRawMany();
		return { rows, total };
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
	 * Returns course sections for an academic period whose course has ONLY active
	 * Control-type outcome mappings articulated for THAT period (mappings from other periods
	 * or study plans don't count). A course with any mapping of another outcome type
	 * (Verification/Formation) is excluded, even if it also has Control mappings.
	 * Electives are included under the same rule. When programId is provided, only
	 * mappings in that program's active study plans and commissions are considered.
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
			  AND EXISTS (
				  SELECT 1
				  FROM academic.study_plan_courses spc
				  INNER JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
				  INNER JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
				  INNER JOIN academic.course_outcome_mappings com ON com.study_plan_course_id = spc.id
				  INNER JOIN core.types ot ON ot.id = com.outcome_type_id
				  INNER JOIN accreditation.outcomes o ON o.id = com.outcome_id
				  INNER JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
				  WHERE spc.course_id = cs.course_id
				    AND spap.academic_period_id = $1
				    AND ot.code = $3
				    AND com.is_active = true
				    AND spc.is_active = true
				    AND sp.is_active = true
				    AND spap.is_active = true
				    AND ($2::int IS NULL OR (
				      sp.program_id = $2 AND pc.program_id = $2
				    ))
			  )
			  AND NOT EXISTS (
				  SELECT 1
				  FROM academic.study_plan_courses spc
				  INNER JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
				  INNER JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
				  INNER JOIN academic.course_outcome_mappings com ON com.study_plan_course_id = spc.id
				  INNER JOIN core.types ot ON ot.id = com.outcome_type_id
				  INNER JOIN accreditation.outcomes o ON o.id = com.outcome_id
				  INNER JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
				  WHERE spc.course_id = cs.course_id
				    AND spap.academic_period_id = $1
				    AND ot.code <> $3
				    AND com.is_active = true
				    AND spc.is_active = true
				    AND sp.is_active = true
				    AND spap.is_active = true
				    AND ($2::int IS NULL OR (
				      sp.program_id = $2 AND pc.program_id = $2
				    ))
			  )
			ORDER BY c.name ASC, cs.section_code ASC`,
			[academicPeriodId, programId ?? null, TYPE_CODES.OUTCOME_TYPE.CONTROL],
		);
	}

	/** Returns all commissions linked to a course section via course-outcome mappings. */
	async getSectionCommissions(
		courseSectionId: number,
		programId?: number | null,
	): Promise<
		{ commissionId: number; code: string; name: unknown; typeCode: string; typeName: unknown }[]
	> {
		// DISTINCT ON keeps one row per base commission while exposing its accreditation
		// commission type (EAC/CAC/…) so the UI can default to EAC. When a commission appears
		// under several types we prefer the EAC one. The outer query then sorts by the Spanish
		// commission name (not allowed directly alongside DISTINCT ON's required ORDER BY).
		return await this.dataSource.query(
			`SELECT "commissionId", "code", "name", "typeCode", "typeName"
			FROM (
				SELECT DISTINCT ON (pc.commission_id)
					pc.commission_id AS "commissionId",
					cm.code          AS "code",
					cm.name          AS "name",
					ct.code          AS "typeCode",
					ct.name          AS "typeName"
				FROM accreditation.program_commissions pc
				INNER JOIN accreditation.commissions cm ON cm.id = pc.commission_id
				LEFT JOIN core.types ct ON ct.id = pc.commission_type_id
				INNER JOIN accreditation.outcomes o ON o.program_commission_id = pc.id
				INNER JOIN academic.course_outcome_mappings com ON com.outcome_id = o.id
				INNER JOIN academic.study_plan_courses spc ON spc.id = com.study_plan_course_id
				INNER JOIN academic.course_sections cs ON cs.course_id = spc.course_id
				WHERE cs.id = $1
				  AND ($2::int IS NULL OR pc.program_id = $2)
				ORDER BY pc.commission_id,
					(COALESCE(ct.code, '') ILIKE '%EAC%' OR COALESCE(ct.name->>'es', '') ILIKE '%EAC%') DESC
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

	/**
	 * Sets is_active for a batch of LCFC config ids in a single transaction, verifying each
	 * is an LCFC config first. Returns the count updated; throws when a config is missing or
	 * not an LCFC config so the caller can surface the i18n error.
	 */
	async updateStatuses(
		updates: { configId: number; isActive: boolean }[],
		onInvalid: () => never,
	): Promise<number> {
		return await this.dataSource.transaction(async (manager) => {
			let updated = 0;
			for (const item of updates) {
				const existing = await manager.findOne(OutcomeConfigEntity, {
					where: { id: item.configId },
				});
				const extra = (existing?.extra as Record<string, unknown>) ?? {};
				if (!existing || extra.surveyType !== LCFC_SURVEY_TYPE) {
					onInvalid();
				}
				await manager.update(OutcomeConfigEntity, item.configId, { isActive: item.isActive });
				updated++;
			}
			return updated;
		});
	}

	/** Stores commissionId inside the config's extra JSON so the survey endpoint can filter by it. */
	async setCommissionId(id: number, commissionId: number): Promise<void> {
		await this.dataSource.query(
			`UPDATE survey.outcome_configs
			 SET extra = jsonb_set(COALESCE(extra, '{}'::jsonb), '{commission_id}', to_jsonb($1::int)),
			     updated_at = NOW()
			 WHERE id = $2`,
			[commissionId, id],
		);
	}

	/**
	 * Removes an LCFC config and the surveys (plus their notifications/scores) generated for
	 * its course section, so the section can later be deleted without dangling FKs from
	 * evidence.surveys.
	 */
	async deleteConfigWithSurveys(
		id: number,
		courseSectionId: number | null,
		academicPeriodId: number | null,
	): Promise<DeleteResult> {
		return await this.dataSource.transaction(async (manager) => {
			if (courseSectionId && academicPeriodId) {
				const surveys: { id: number }[] = await manager.query(
					`SELECT s.id FROM evidence.surveys s
					 WHERE s.survey_type_id = (SELECT id FROM core.types WHERE code = $1)
					   AND s.course_section_id = $2
					   AND s.academic_period_id = $3`,
					[TYPE_CODES.SURVEY_TYPE.LCFC, courseSectionId, academicPeriodId],
				);
				const surveyIds = surveys.map((r) => r.id);
				if (surveyIds.length > 0) {
					await manager.query(`DELETE FROM survey.scores WHERE survey_id = ANY($1)`, [surveyIds]);
					await manager.query(`DELETE FROM survey.notifications WHERE survey_id = ANY($1)`, [
						surveyIds,
					]);
					await manager.query(`DELETE FROM evidence.surveys WHERE id = ANY($1)`, [surveyIds]);
				}
			}
			return await manager.delete(OutcomeConfigEntity, id);
		});
	}
}
