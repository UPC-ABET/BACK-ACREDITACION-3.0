import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { CourseRepository } from '../core/courses.repository';
import { CourseValidation } from '../core/courses.validation';
import {
	CreateCourseDto,
	FilterCourseDto,
	UpdateCourseDto,
	FilterCourseEnrolledStudentsDto,
	CourseEnrolledStudentDto,
	CourseLookupItem,
} from '../model/courses.dtos';
import { EntityManager } from 'typeorm';
import { LookupQueryDto } from 'src/commons/lookup.dtos';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';
import { ScopeFilters } from 'src/commons/scope.dtos';

@Injectable()
export class CourseService extends BaseService<CourseRepository> {
	constructor(protected readonly repository: CourseRepository) {
		super(repository);
	}

	async create(dto: CreateCourseDto, manager?: EntityManager) {
		await CourseValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateCourseDto, manager?: EntityManager) {
		await CourseValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await CourseValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getByFilters(filters: FilterCourseDto & ScopeFilters) {
		return await this.repository.getByFilters(filters);
	}

	async getLookup(query: LookupQueryDto): Promise<PaginatedResult<CourseLookupItem>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [courses, total] = await this.repository.findLookupPage(query.search, skip, take);
		const items = courses.map((course) => ({
			id: course.id,
			code: course.code,
			name: course.name,
		}));
		return toPaginated(items, total, page, pageSize);
	}

	async getEnrolledStudentsByCourseId(
		courseId: number,
		filters?: FilterCourseEnrolledStudentsDto,
	): Promise<CourseEnrolledStudentDto[]> {
		const results = await this.repository.findEnrolledStudents(courseId, filters);

		return results.map(
			(item) =>
				({
					id: item.enrolledStudentId,
					studentSectionEnrollmentId: item.id,
					studentId: item.enrolledStudent.studentId,
					firstName: item.enrolledStudent.student.firstName || '',
					lastName: item.enrolledStudent.student.lastName || '',
					email: item.enrolledStudent.student.email || '',
					studentCode: `EST-${item.enrolledStudent.student.code}`,
					courseSectionId: item.courseSectionId,
					sectionCode: item.courseSection.sectionCode,
					professorId: item.courseSection.professorId,
					professorFirstName:
						item.courseSection.professor.staff.user?.firstName ||
						item.courseSection.professor.staff.firstName ||
						'',
					professorLastName:
						item.courseSection.professor.staff.user?.lastName ||
						item.courseSection.professor.staff.lastName ||
						'',
					campusId: item.courseSection.campusId,
					enrollmentDate: item.createdAt,
					isActive: item.isActive,
				}) as CourseEnrolledStudentDto,
		);
	}
}
