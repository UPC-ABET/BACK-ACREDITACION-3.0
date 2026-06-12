import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { StudentSectionEnrollmentEntity } from '../model/student-section-enrollments.entity';

export interface StudentSectionEnrollmentDeleteBlockerCounts {
	studentCourseGrades: number;
	projectStudents: number;
	studentCourseOutcomeGrades: number;
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

	async findMaintenancePage(
		academicPeriodId: number,
		programId: number | undefined,
		search: string | undefined,
		skip: number,
		take: number,
	): Promise<[StudentSectionEnrollmentEntity[], number]> {
		const qb = this.maintenanceQuery().where('section.academic_period_id = :academicPeriodId', {
			academicPeriodId,
		});

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
