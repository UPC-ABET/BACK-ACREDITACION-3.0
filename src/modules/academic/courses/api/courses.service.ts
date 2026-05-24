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
} from '../model/courses.dtos';
import { EntityManager, DataSource } from 'typeorm';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';

@Injectable()
export class CourseService extends BaseService<CourseRepository> {
	constructor(
		protected readonly repository: CourseRepository,
		private readonly dataSource: DataSource,
	) {
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

	async getByFilters(filters: FilterCourseDto) {
		return await this.repository.getByFilters(filters);
	}

	async getEnrolledStudentsByCourseId(
		courseId: number,
		filters?: FilterCourseEnrolledStudentsDto,
	): Promise<CourseEnrolledStudentDto[]> {
		const qb = this.dataSource
			.getRepository(StudentSectionEnrollmentEntity)
			.createQueryBuilder('sse')
			.innerJoinAndSelect('sse.course_section', 'cs')
			.innerJoinAndSelect('cs.study_plan_course', 'spc', 'spc.course_id = :courseId', { courseId })
			.innerJoinAndSelect('sse.enrolled_student', 'es')
			.innerJoinAndSelect('es.student', 's')
			.innerJoinAndSelect('s.user', 'student_user')
			.innerJoinAndSelect('cs.professor', 'p')
			.innerJoinAndSelect('p.staff', 'st')
			.innerJoinAndSelect('st.user', 'prof_user');

		// Apply filters
		if (filters?.is_active !== undefined) {
			qb.andWhere('sse.is_active = :sse_is_active', { sse_is_active: filters.is_active });
			qb.andWhere('es.is_active = :es_is_active', { es_is_active: filters.is_active });
		}

		if (filters?.academic_period_id !== undefined) {
			qb.innerJoin(
				'spc.study_plan_academic_period',
				'spap',
				'spap.academic_period_id = :academic_period_id',
				{ academic_period_id: filters.academic_period_id },
			);
		}

		if (filters?.campus_id !== undefined) {
			qb.andWhere('cs.campus_id = :campus_id', { campus_id: filters.campus_id });
		}

		if (filters?.study_plan_academic_period_id !== undefined) {
			qb.andWhere('spc.study_plan_academic_period_id = :spap_id', {
				spap_id: filters.study_plan_academic_period_id,
			});
		}

		const results = await qb.getMany();

		return results.map(
			(item) =>
				({
					id: item.enrolled_student_id,
					student_section_enrollment_id: item.id,
					student_id: item.enrolled_student.student_id,
					first_name: item.enrolled_student.student.user.first_name,
					last_name: item.enrolled_student.student.user.last_name,
					email: item.enrolled_student.student.user.email,
					student_code: `EST-${item.enrolled_student.student.user.document_code}`,
					course_section_id: item.course_section_id,
					section_code: item.course_section.section_code,
					professor_id: item.course_section.professor_id,
					professor_first_name: item.course_section.professor.staff.user.first_name,
					professor_last_name: item.course_section.professor.staff.user.last_name,
					campus_id: item.course_section.campus_id,
					enrollment_date: item.created_at,
					is_active: item.is_active,
				}) as CourseEnrolledStudentDto,
		);
	}
}
