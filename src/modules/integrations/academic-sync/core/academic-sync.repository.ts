import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import type { I18nText } from 'src/shared/types/i18n';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { AcademicPeriodRepository } from 'src/modules/academic/academic-periods/core/academic-periods.repository';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';
import { CampusRepository } from 'src/modules/organization/campuses/core/campuses.repository';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { StudyPlanCourseRepository } from 'src/modules/academic/study-plan-courses/core/study-plan-courses.repository';
import { CourseSectionEntity } from 'src/modules/academic/course-sections/model/course-sections.entity';
import { CourseSectionRepository } from 'src/modules/academic/course-sections/core/course-sections.repository';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';

export interface CommissionOption {
	id: number;
	code: string;
	name: I18nText;
	/// `accreditation.program_commissions.id` — the join key `outcomes.program_commission_id`
	/// actually needs; distinct from `id` above (which is `commissions.id`, the commission itself).
	programCommissionId: number;
}

export interface OutcomeOption {
	id: number;
	code: string;
	name: I18nText;
}

export interface OrgChartNodeRow {
	id: number;
	parentId: number | null;
	entityType: string | null;
	entityCode: number | null;
	organizationLevelTitle: I18nText;
	staffId: number | null;
	staffFirstName: string | null;
	staffLastName: string | null;
	staffEmail: string | null;
	staffTitle: I18nText | null;
	professorCode: string | null;
	entityResolvedCode: string | null;
	entityResolvedName: I18nText | null;
}

// A program can be linked to more than one active commission in the same period. EAC is the
// accreditor this integration cares about when it's present; falling back to the first commission
// alphabetically by code keeps the choice deterministic otherwise, mirroring the
// `ORDER BY ... com.code` convention ProgramCommissionRepository already uses elsewhere in this
// schema (there is no priority/order column to sort by instead). The match on 'EAC' is intentionally
// case-sensitive — commission codes are business codes, not free text.
export function pickPreferredCommission(options: CommissionOption[]): CommissionOption | null {
	if (options.length === 0) return null;
	const eac = options.find((option) => option.code === 'EAC');
	if (eac) return eac;
	return [...options].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))[0];
}

@Injectable()
export class AcademicSyncRepository {
	constructor(
		private readonly dataSource: DataSource,
		private readonly academicPeriodRepository: AcademicPeriodRepository,
		private readonly campusRepository: CampusRepository,
		private readonly studyPlanCourseRepository: StudyPlanCourseRepository,
		private readonly courseSectionRepository: CourseSectionRepository,
	) {}

	async getPeriods(): Promise<AcademicPeriodEntity[]> {
		return await this.academicPeriodRepository.findAll({ order: { startDate: 'DESC' } });
	}

	async getCampuses(): Promise<CampusEntity[]> {
		return await this.campusRepository.findAll({ order: { code: 'ASC' } });
	}

	// Reuses StudyPlanCourseRepository.getByFilters as-is: it already joins `course` and maps
	// `program` through the study-plan-academic-period -> study-plan chain (see that repository's
	// comment on why the chain is always resolvable), which is exactly the course+program shape
	// this endpoint needs.
	async getCoursesForPeriod(academicPeriodId: number): Promise<StudyPlanCourseEntity[]> {
		return await this.studyPlanCourseRepository.getByFilters({ academicPeriodId });
	}

	async getSectionsForCourses(
		courseIds: number[],
		academicPeriodId: number,
	): Promise<CourseSectionEntity[]> {
		if (courseIds.length === 0) return [];
		return await this.courseSectionRepository.findByCondition(
			{ where: { courseId: In(courseIds), academicPeriodId } },
			['campus', 'sectionModalityType'],
		);
	}

	async getCommissionsByPrograms(
		programIds: number[],
		academicPeriodId: number,
	): Promise<Map<number, CommissionOption[]>> {
		const map = new Map<number, CommissionOption[]>();
		if (programIds.length === 0) return map;

		const rows: Array<{
			programId: number;
			id: number;
			code: string;
			name: I18nText;
			programCommissionId: number;
		}> = await this.dataSource.query(
			`SELECT
				pc.program_id AS "programId",
				com.id        AS "id",
				com.code      AS "code",
				com.name      AS "name",
				pc.id         AS "programCommissionId"
			FROM accreditation.program_commissions pc
			INNER JOIN accreditation.commissions com ON com.id = pc.commission_id AND com.is_active = true
			WHERE pc.program_id = ANY($1::int[])
			  AND pc.academic_period_id = $2
			  AND pc.is_active = true
			ORDER BY pc.program_id, com.code ASC`,
			[programIds, academicPeriodId],
		);

		for (const row of rows) {
			const list = map.get(row.programId) ?? [];
			list.push({
				id: row.id,
				code: row.code,
				name: row.name,
				programCommissionId: row.programCommissionId,
			});
			map.set(row.programId, list);
		}
		return map;
	}

	// The "first" outcome per course, scoped to one specific program_commission (the one already
	// chosen by pickPreferredCommission for that course's program) — lets a Blackboard-export-style
	// {OUTCOME} token auto-resolve to the curriculum's actual mapping instead of being typed by
	// hand. `outcome.outcome_name` (a bare "2", not the compound "EAC-SI-2" outcome_code) is what
	// callers want here — the accreditor/program prefix is already conveyed separately via `commission`.
	async getFirstOutcomesForStudyPlanCourses(
		studyPlanCourseIds: number[],
		programCommissionIds: number[],
	): Promise<Map<number, OutcomeOption>> {
		const map = new Map<number, OutcomeOption>();
		if (studyPlanCourseIds.length === 0 || programCommissionIds.length === 0) return map;

		const rows: Array<{ studyPlanCourseId: number; id: number; code: string; name: I18nText }> =
			await this.dataSource.query(
				`SELECT DISTINCT ON (com.study_plan_course_id)
					com.study_plan_course_id AS "studyPlanCourseId",
					o.id                     AS "id",
					o.outcome_code           AS "code",
					o.outcome_name           AS "name"
				FROM academic.course_outcome_mappings com
				INNER JOIN accreditation.outcomes o ON o.id = com.outcome_id AND o.is_active = true
				WHERE com.study_plan_course_id = ANY($1::int[])
				  AND o.program_commission_id = ANY($2::int[])
				  AND com.is_active = true
				ORDER BY com.study_plan_course_id, o.outcome_code ASC`,
				[studyPlanCourseIds, programCommissionIds],
			);

		for (const row of rows) {
			map.set(row.studyPlanCourseId, { id: row.id, code: row.code, name: row.name });
		}
		return map;
	}

	// Mirrors ChartRepository.getMaintenanceBranch's entity resolution (COALESCE across
	// School/Program/Course, joined by entity type code) so an external caller sees the same
	// "Escuela ISW · Ingenieria de Software"-style label Acreditación's own UI shows — otherwise
	// a SCHOOL/PROGRAM/COURSE node carries only an opaque entity_code with nothing to display.
	async getOrgChartNodes(academicPeriodId: number): Promise<OrgChartNodeRow[]> {
		return await this.dataSource.query(
			`SELECT
				c.id                 AS "id",
				c.root_chart_id      AS "parentId",
				et.code              AS "entityType",
				c.entity_code        AS "entityCode",
				c.title              AS "organizationLevelTitle",
				s.id                 AS "staffId",
				s.first_name         AS "staffFirstName",
				s.last_name          AS "staffLastName",
				s.staff_email        AS "staffEmail",
				s.job_title          AS "staffTitle",
				prof.code            AS "professorCode",
				COALESCE(sch.code, prog.code, crs.code) AS "entityResolvedCode",
				COALESCE(sch.name, prog.name, crs.name) AS "entityResolvedName"
			FROM organization.charts c
			LEFT JOIN core.types et             ON et.id = c.entity_type_id
			LEFT JOIN organization.staff s      ON s.id = c.staff_id
			LEFT JOIN academic.professors prof  ON prof.staff_id = s.id
			LEFT JOIN organization.schools sch  ON et.code = $2 AND sch.id = c.entity_code
			LEFT JOIN academic.programs prog    ON et.code = $3 AND prog.id = c.entity_code
			LEFT JOIN academic.courses crs      ON et.code = $4 AND crs.id = c.entity_code
			WHERE c.academic_period_id = $1 AND c.is_active = true
			ORDER BY c.id`,
			[
				academicPeriodId,
				TYPE_CODES.ENTITY_TYPE.SCHOOL,
				TYPE_CODES.ENTITY_TYPE.PROGRAM,
				TYPE_CODES.ENTITY_TYPE.COURSE,
			],
		);
	}

	async getUsersPage(skip: number, take: number): Promise<[UserEntity[], number]> {
		return await this.dataSource
			.createQueryBuilder(UserEntity, 'u')
			.orderBy('u.id', 'ASC')
			.skip(skip)
			.take(take)
			.getManyAndCount();
	}
}
