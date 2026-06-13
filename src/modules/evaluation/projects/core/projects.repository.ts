import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ProjectEntity } from '../model/projects.entity';
import { FilterProjectDto } from '../model/projects.dtos';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { EnrolledStudentEntity } from 'src/modules/academic/enrolled-students/model/enrolled-students.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';
import { CourseSectionEntity } from 'src/modules/academic/course-sections/model/course-sections.entity';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { StudyPlanAcademicPeriodEntity } from 'src/modules/academic/study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { StudyPlanEntity } from 'src/modules/academic/study-plans/model/study-plans.entity';

export class ProjectRepository extends BaseRepository<ProjectEntity> {
	constructor(
		@InjectRepository(ProjectEntity)
		repository: Repository<ProjectEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getByFilters(filters: FilterProjectDto): Promise<any[]> {
		const qb = this.dataSource
			.createQueryBuilder(ProjectEntity, 'project')
			.leftJoinAndSelect('project.students', 'ps')
			.leftJoinAndSelect('project.evaluators', 'pe')
			.leftJoin(
				StudentSectionEnrollmentEntity,
				'sse_enrich',
				'sse_enrich.id = ps.student_section_enrollment_id',
			)
			.leftJoin(EnrolledStudentEntity, 'es_enrich', 'es_enrich.id = sse_enrich.enrolled_student_id')
			.leftJoin(StudentEntity, 'st_enrich', 'st_enrich.id = es_enrich.student_id')
			.leftJoin(UserEntity, 'u_enrich', 'u_enrich.id = st_enrich.user_id')
			.leftJoin(CourseSectionEntity, 'cs_enrich', 'cs_enrich.id = sse_enrich.course_section_id')
			.leftJoin(ProfessorEntity, 'prof_enrich', 'prof_enrich.id = pe.professor_id')
			.leftJoin(StaffEntity, 'staff_enrich', 'staff_enrich.id = prof_enrich.staff_id')
			.leftJoin(UserEntity, 'u_prof_enrich', 'u_prof_enrich.id = staff_enrich.user_id')
			.leftJoin(TypeEntity, 'eval_type_enrich', 'eval_type_enrich.id = pe.evaluator_type_id')
			.addSelect('u_enrich.first_name', 'u_enrich_first_name')
			.addSelect('u_enrich.last_name', 'u_enrich_last_name')
			.addSelect('st_enrich.id', 'st_enrich_id')
			.addSelect('st_enrich.first_name', 'st_enrich_first_name')
			.addSelect('st_enrich.last_name', 'st_enrich_last_name')
			.addSelect('cs_enrich.section_code', 'cs_enrich_section_code')
			.addSelect('cs_enrich.id', 'cs_enrich_id')
			.addSelect('u_prof_enrich.first_name', 'u_prof_enrich_first_name')
			.addSelect('u_prof_enrich.last_name', 'u_prof_enrich_last_name')
			.addSelect('staff_enrich.first_name', 'staff_enrich_first_name')
			.addSelect('staff_enrich.last_name', 'staff_enrich_last_name')
			.addSelect('eval_type_enrich.name', 'eval_type_enrich_name')
			.addSelect('eval_type_enrich.code', 'eval_type_enrich_code');

		if (filters.code) {
			qb.andWhere('project.code = :code', { code: filters.code });
		}
		if (filters.isActive !== undefined) {
			qb.andWhere('project.is_active = :isActive', { isActive: filters.isActive });
		}

		if (filters.professorId) {
			qb.andWhere('pe.professor_id = :professorId', { professorId: filters.professorId });
		}

		const needsEnrollment = !!(
			filters.studentId ||
			filters.courseId ||
			filters.academicPeriodId ||
			filters.programId
		);
		const needsCourseSection = !!(filters.courseId || filters.academicPeriodId);
		const needsEnrolledStudent = !!(filters.studentId || filters.programId);
		const needsSpap = !!filters.programId;
		const needsSp = !!filters.programId;

		if (needsEnrollment) {
			qb.leftJoin(
				StudentSectionEnrollmentEntity,
				'sse',
				'sse.id = ps.student_section_enrollment_id',
			);
		}

		if (needsEnrolledStudent) {
			qb.leftJoin(EnrolledStudentEntity, 'es', 'es.id = sse.enrolled_student_id');
		}

		if (filters.studentId) {
			qb.andWhere('es.student_id = :studentId', { studentId: filters.studentId });
		}

		if (needsCourseSection) {
			qb.leftJoin(CourseSectionEntity, 'cs', 'cs.id = sse.course_section_id');
		}

		if (filters.courseId) {
			qb.andWhere('cs.course_id = :courseId', { courseId: filters.courseId });
		}

		if (filters.academicPeriodId) {
			qb.andWhere('cs.academic_period_id = :academicPeriodId', {
				academicPeriodId: filters.academicPeriodId,
			});
		}

		if (needsSpap) {
			qb.leftJoin(StudyPlanAcademicPeriodEntity, 'spap', 'spap.id = es.study_plan_academic_period');
		}

		if (needsSp) {
			qb.leftJoin(StudyPlanEntity, 'sp', 'sp.id = spap.study_plan_id');
		}

		if (filters.programId) {
			qb.andWhere('sp.program_id = :programId', { programId: filters.programId });
		}

		const { entities, raw } = await qb.getRawAndEntities();

		return entities.map((project) => {
			const projectRaws = raw.filter((r) => r.project_id === project.id);

			return {
				...project,
				students: project.students.map((student) => {
					const studentRaw = projectRaws.find((r) => r.ps_id === student.id);
					return {
						...student,
						studentInfo: studentRaw
							? {
									firstName:
										studentRaw.u_enrich_first_name || studentRaw.st_enrich_first_name || '',
									lastName: studentRaw.u_enrich_last_name || studentRaw.st_enrich_last_name || '',
									studentId: studentRaw.st_enrich_id,
									sectionCode: studentRaw.cs_enrich_section_code,
									sectionId: studentRaw.cs_enrich_id,
								}
							: null,
					};
				}),
				evaluators: project.evaluators.map((evaluator) => {
					const evalRaw = projectRaws.find((r) => r.pe_id === evaluator.id);
					return {
						...evaluator,
						evaluatorInfo: evalRaw
							? {
									firstName:
										evalRaw.u_prof_enrich_first_name || evalRaw.staff_enrich_first_name || '',
									lastName: evalRaw.u_prof_enrich_last_name || evalRaw.staff_enrich_last_name || '',
									evaluatorTypeName: evalRaw.eval_type_enrich_name,
									evaluatorTypeCode: evalRaw.eval_type_enrich_code,
								}
							: null,
					};
				}),
			};
		});
	}
}
