import { Injectable } from '@nestjs/common';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';
import { CourseSectionEntity } from 'src/modules/academic/course-sections/model/course-sections.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import {
	AcademicSyncRepository,
	CommissionOption,
	pickPreferredCommission,
} from '../core/academic-sync.repository';
import {
	AcademicSyncCampusDto,
	AcademicSyncCourseDto,
	AcademicSyncOrgChartNodeDto,
	AcademicSyncPeriodDto,
	AcademicSyncUserDto,
	AcademicSyncUsersQueryDto,
} from '../model/academic-sync.dtos';

@Injectable()
export class AcademicSyncService {
	constructor(private readonly repository: AcademicSyncRepository) {}

	async getPeriods(): Promise<AcademicSyncPeriodDto[]> {
		const periods = await this.repository.getPeriods();
		return periods.map((period) => ({
			id: period.id,
			code: period.code,
			startDate: period.startDate,
			endDate: period.endDate,
			year: period.year,
			modalityTypeId: period.modalityTypeId,
		}));
	}

	async getCampuses(): Promise<AcademicSyncCampusDto[]> {
		const campuses = await this.repository.getCampuses();
		return campuses.map((campus) => ({ id: campus.id, code: campus.code, name: campus.name }));
	}

	async getCourses(academicPeriodId: number): Promise<AcademicSyncCourseDto[]> {
		const rows = await this.repository.getCoursesForPeriod(academicPeriodId);
		if (rows.length === 0) return [];

		const courseIds = rows.map((row) => row.courseId);
		const programIds = [...new Set(rows.map((row) => row.program?.id).filter((id) => id != null))];

		const [sections, commissionsByProgram] = await Promise.all([
			this.repository.getSectionsForCourses(courseIds, academicPeriodId),
			this.repository.getCommissionsByPrograms(programIds, academicPeriodId),
		]);

		const sectionsByCourse = this.groupSectionsByCourse(sections);
		return rows.map((row) => this.toCourseDto(row, sectionsByCourse, commissionsByProgram));
	}

	async getOrgChart(academicPeriodId: number): Promise<AcademicSyncOrgChartNodeDto[]> {
		const rows = await this.repository.getOrgChartNodes(academicPeriodId);
		return rows.map((row) => ({
			id: row.id,
			parentId: row.parentId,
			entityType: row.entityType,
			entityCode: row.entityCode,
			staff:
				row.staffId !== null
					? {
							id: row.staffId,
							firstName: row.staffFirstName ?? '',
							lastName: row.staffLastName ?? '',
							email: row.staffEmail,
						}
					: null,
		}));
	}

	async getUsers(query: AcademicSyncUsersQueryDto): Promise<PaginatedResult<AcademicSyncUserDto>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [users, total] = await this.repository.getUsersPage(skip, take);
		const items = users.map((user) => ({
			id: user.id,
			documentCode: user.documentCode,
			firstName: user.firstName,
			lastName: user.lastName,
			email: user.email,
			phone: user.phone,
		}));
		return toPaginated(items, total, page, pageSize);
	}

	private groupSectionsByCourse(
		sections: CourseSectionEntity[],
	): Map<number, CourseSectionEntity[]> {
		const map = new Map<number, CourseSectionEntity[]>();
		for (const section of sections) {
			const list = map.get(section.courseId) ?? [];
			list.push(section);
			map.set(section.courseId, list);
		}
		return map;
	}

	private toCourseDto(
		row: StudyPlanCourseEntity,
		sectionsByCourse: Map<number, CourseSectionEntity[]>,
		commissionsByProgram: Map<number, CommissionOption[]>,
	): AcademicSyncCourseDto {
		// `program` is always populated by getByFilters — see StudyPlanCourseRepository's own note on
		// why that join chain can never miss.
		const program = row.program!;
		const commission = pickPreferredCommission(commissionsByProgram.get(program.id) ?? []);
		const sections = sectionsByCourse.get(row.courseId) ?? [];

		return {
			id: row.course.id,
			code: row.course.code,
			name: row.course.name,
			description: row.course.description,
			learningOutcome: row.course.learningOutcome,
			program: { id: program.id, code: program.code, name: program.name },
			commission: commission
				? { id: commission.id, code: commission.code, name: commission.name }
				: null,
			sections: sections.map((section) => ({
				id: section.id,
				sectionCode: section.sectionCode,
				campus: section.campus
					? { id: section.campus.id, code: section.campus.code, name: section.campus.name }
					: null,
			})),
		};
	}
}
