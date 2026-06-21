import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { CourseEntity } from '../model/courses.entity';
import { FilterCourseDto, FilterCourseEnrolledStudentsDto } from '../model/courses.dtos';
import { StudyPlanCourseEntity } from '../../study-plan-courses/model/study-plan-courses.entity';
import { StudyPlanAcademicPeriodEntity } from '../../study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { StudyPlanEntity } from '../../study-plans/model/study-plans.entity';
import { ScopeFilters } from 'src/commons/scope.dtos';
import {
	programInSchoolSubquery,
	schoolProgramFilterParams,
} from 'src/libs/school-program.functions';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';

export class CourseRepository extends BaseRepository<CourseEntity> {
	constructor(
		@InjectRepository(CourseEntity)
		repository: Repository<CourseEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getByFilters(filters: FilterCourseDto & ScopeFilters): Promise<CourseEntity[]> {
		const academicPeriodId = filters.academicPeriodId ?? undefined;
		const schoolId = filters.schoolId ?? undefined;

		const qb = this.dataSource.createQueryBuilder(CourseEntity, 'c');

		if (filters.code) qb.andWhere('c.code = :code', { code: filters.code });
		if (filters.isActive !== undefined)
			qb.andWhere('c.is_active = :isActive', { isActive: filters.isActive });

		const needsJoins = !!(academicPeriodId || filters.programId || schoolId);

		if (needsJoins) {
			qb.innerJoin(StudyPlanCourseEntity, 'spc', 'spc.course_id = c.id');
			qb.innerJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = spc.study_plan_academic_period_id',
			);
			qb.innerJoin(StudyPlanEntity, 'sp', 'sp.id = spap.study_plan_id');
		}

		if (academicPeriodId) {
			qb.andWhere('spap.academic_period_id = :academicPeriodId', { academicPeriodId });
		}

		if (filters.programId) {
			qb.andWhere('sp.program_id = :programId', { programId: filters.programId });
		}

		if (schoolId) {
			qb.andWhere(programInSchoolSubquery('sp.program_id')).setParameters(
				schoolProgramFilterParams(schoolId),
			);
		}

		return await qb.getMany();
	}

	async findLookupPage(
		search: string | undefined,
		skip: number,
		take: number,
	): Promise<[CourseEntity[], number]> {
		const qb = this.dataSource.createQueryBuilder(CourseEntity, 'c');

		if (search?.trim()) {
			const term = `%${search.trim()}%`;
			qb.where(`(c.code ILIKE :term OR c.name->>'es' ILIKE :term OR c.name->>'en' ILIKE :term)`, {
				term,
			});
		}

		return await qb.orderBy('c.code', 'ASC').skip(skip).take(take).getManyAndCount();
	}

	async findEnrolledStudents(
		courseId: number,
		filters?: FilterCourseEnrolledStudentsDto,
	): Promise<StudentSectionEnrollmentEntity[]> {
		const qb = this.dataSource
			.getRepository(StudentSectionEnrollmentEntity)
			.createQueryBuilder('sse')
			.innerJoinAndSelect('sse.courseSection', 'cs')
			.innerJoinAndSelect('sse.enrolledStudent', 'es')
			.innerJoinAndSelect('es.student', 's')
			.innerJoinAndSelect('cs.professor', 'p')
			.innerJoinAndSelect('p.staff', 'st')
			.leftJoinAndSelect('st.user', 'prof_user')
			.where('cs.course_id = :courseId', { courseId });

		if (filters?.isActive !== undefined) {
			qb.andWhere('sse.is_active = :sseIsActive', { sseIsActive: filters.isActive });
			qb.andWhere('es.is_active = :esIsActive', { esIsActive: filters.isActive });
		}

		if (filters?.academicPeriodId !== undefined) {
			qb.andWhere('cs.academic_period_id = :academicPeriodId', {
				academicPeriodId: filters.academicPeriodId,
			});
		}

		if (filters?.campusId !== undefined) {
			qb.andWhere('cs.campus_id = :campusId', { campusId: filters.campusId });
		}

		if (filters?.studyPlanAcademicPeriodId !== undefined) {
			qb.andWhere(
				`cs.course_id IN (SELECT spc_filter.course_id FROM academic.study_plan_courses spc_filter WHERE spc_filter.study_plan_academic_period_id = :studyPlanAcademicPeriodId)`,
				{ studyPlanAcademicPeriodId: filters.studyPlanAcademicPeriodId },
			);
		}

		return await qb.getMany();
	}
}
