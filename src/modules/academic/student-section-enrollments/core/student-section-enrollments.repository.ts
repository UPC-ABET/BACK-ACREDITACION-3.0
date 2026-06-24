import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { StudentSectionEnrollmentEntity } from '../model/student-section-enrollments.entity';

export interface StudentSectionEnrollmentDeleteBlockerCounts {
	studentCourseGrades: number;
	projectStudents: number;
	studentCourseOutcomeGrades: number;
}

export interface StudentSectionStudyPlanEligibility {
	periodMatches: boolean;
	courseInPlan: boolean;
}

export class StudentSectionEnrollmentRepository extends BaseRepository<StudentSectionEnrollmentEntity> {
	constructor(
		@InjectRepository(StudentSectionEnrollmentEntity)
		repository: Repository<StudentSectionEnrollmentEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	private maintenanceQuery() {
		return this.dataSource
			.createQueryBuilder(StudentSectionEnrollmentEntity, 'sse')
			.innerJoinAndSelect('sse.courseSection', 'section')
			.innerJoinAndSelect('section.course', 'course')
			.innerJoinAndSelect('sse.enrolledStudent', 'enrolled')
			.innerJoinAndSelect('enrolled.student', 'student');
	}

	async findByIdWithRelations(id: number): Promise<StudentSectionEnrollmentEntity | null> {
		return await this.maintenanceQuery().where('sse.id = :id', { id }).getOne();
	}

	async findByStudentAndSectionCode(
		studentCode: string,
		sectionCode: string,
		academicPeriodId?: number,
	): Promise<StudentSectionEnrollmentEntity | null> {
		const qb = this.maintenanceQuery()
			.where('student.code = :studentCode', { studentCode })
			.andWhere('section.sectionCode = :sectionCode', { sectionCode });

		if (academicPeriodId !== undefined) {
			qb.andWhere('section.academicPeriodId = :academicPeriodId', { academicPeriodId });
		}

		return await qb.getOne();
	}

	async findByClassRepresentativeFlag(
		isClassRepresentative = true,
	): Promise<StudentSectionEnrollmentEntity[]> {
		return await this.maintenanceQuery()
			.where('sse.isClassRepresentative = :flag', { flag: isClassRepresentative })
			.orderBy('course.code', 'ASC')
			.addOrderBy('section.sectionCode', 'ASC')
			.getMany();
	}

	async findMaintenancePage(
		academicPeriodId: number,
		programId: number | undefined,
		search: string | undefined,
		skip: number,
		take: number,
		isClassRepresentative?: boolean,
	): Promise<[StudentSectionEnrollmentEntity[], number]> {
		const qb = this.maintenanceQuery().where('section.academic_period_id = :academicPeriodId', {
			academicPeriodId,
		});

		if (isClassRepresentative !== undefined) {
			qb.andWhere('sse.isClassRepresentative = :isClassRepresentative', { isClassRepresentative });
		}

		if (programId !== undefined) {
			qb.andWhere('student.program_id = :programId', { programId });
		}

		if (search?.trim()) {
			const term = `%${search.trim()}%`;
			qb.andWhere(
				`(course.code ILIKE :term
					OR section.section_code ILIKE :term
					OR student.code ILIKE :term
					OR student.firstName ILIKE :term
					OR student.lastName ILIKE :term)`,
				{ term },
			);
		}

		return await qb
			.orderBy('course.code', 'ASC')
			.addOrderBy('section.sectionCode', 'ASC')
			.addOrderBy('student.lastName', 'ASC')
			.addOrderBy('sse.id', 'ASC')
			.skip(skip)
			.take(take)
			.getManyAndCount();
	}

	async checkStudyPlanEligibility(
		enrolledStudentId: number,
		courseSectionId: number,
	): Promise<StudentSectionStudyPlanEligibility> {
		const [row] = await this.dataSource.query(
			`SELECT
				EXISTS (
					SELECT 1
					FROM academic.enrolled_students es
					JOIN academic.course_sections cs ON cs.id = $2
					JOIN academic.study_plan_academic_periods spap ON spap.id = es.study_plan_academic_period
					WHERE es.id = $1 AND spap.academic_period_id = cs.academic_period_id
				) AS "periodMatches",
				EXISTS (
					SELECT 1
					FROM academic.enrolled_students es
					JOIN academic.course_sections cs ON cs.id = $2
					JOIN academic.study_plan_courses spc
						ON spc.study_plan_academic_period_id = es.study_plan_academic_period
					   AND spc.course_id = cs.course_id
					WHERE es.id = $1
				) AS "courseInPlan"`,
			[enrolledStudentId, courseSectionId],
		);

		return {
			periodMatches: row.periodMatches === true,
			courseInPlan: row.courseInPlan === true,
		};
	}

	async findDeleteBlockerCounts(id: number): Promise<StudentSectionEnrollmentDeleteBlockerCounts> {
		const [row] = await this.dataSource.query(
			`SELECT
				(SELECT COUNT(*) FROM academic.student_course_grades WHERE student_section_enrollment_id = $1) AS "studentCourseGrades",
				(SELECT COUNT(*) FROM evaluation.project_students WHERE student_section_enrollment_id = $1) AS "projectStudents",
				(SELECT COUNT(*) FROM evidence.student_course_outcome_grades WHERE student_section_enrollment_id = $1) AS "studentCourseOutcomeGrades"`,
			[id],
		);

		return {
			studentCourseGrades: Number(row.studentCourseGrades),
			projectStudents: Number(row.projectStudents),
			studentCourseOutcomeGrades: Number(row.studentCourseOutcomeGrades),
		};
	}
}
