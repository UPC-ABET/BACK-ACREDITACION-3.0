import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import type { I18nText } from 'src/shared/types/i18n';
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
}

export interface OrgChartNodeRow {
	id: number;
	parentId: number | null;
	entityType: string | null;
	entityCode: number | null;
	staffId: number | null;
	staffFirstName: string | null;
	staffLastName: string | null;
	staffEmail: string | null;
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

		const rows: Array<{ programId: number; id: number; code: string; name: I18nText }> =
			await this.dataSource.query(
				`SELECT
					pc.program_id AS "programId",
					com.id        AS "id",
					com.code      AS "code",
					com.name      AS "name"
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
			list.push({ id: row.id, code: row.code, name: row.name });
			map.set(row.programId, list);
		}
		return map;
	}

	async getOrgChartNodes(academicPeriodId: number): Promise<OrgChartNodeRow[]> {
		return await this.dataSource.query(
			`SELECT
				c.id            AS "id",
				c.root_chart_id AS "parentId",
				et.code         AS "entityType",
				c.entity_code   AS "entityCode",
				s.id            AS "staffId",
				s.first_name    AS "staffFirstName",
				s.last_name     AS "staffLastName",
				s.staff_email   AS "staffEmail"
			FROM organization.charts c
			LEFT JOIN core.types et        ON et.id = c.entity_type_id
			LEFT JOIN organization.staff s ON s.id = c.staff_id
			WHERE c.academic_period_id = $1 AND c.is_active = true
			ORDER BY c.id`,
			[academicPeriodId],
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
