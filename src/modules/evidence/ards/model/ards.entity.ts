import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { DateColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { CourseEntity } from 'src/modules/academic/courses/model/courses.entity';
import { EnrolledStudentEntity } from 'src/modules/academic/enrolled-students/model/enrolled-students.entity';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';

@Entity({ name: 'ard', schema: 'evidence' })
@Unique('UQ_ard_period_meeting_campus_program', [
	'academicPeriodId',
	'meetingDate',
	'campusId',
	'programId',
])
export class ArdEntity extends BaseEntity {
	@DateColumn({ nullable: false, withDefault: false, type: 'date' })
	meetingDate: Date;

	@IntegerFKIDColumn({ nullable: false })
	campusId: number;

	@IntegerFKIDColumn({ nullable: false })
	academicPeriodId: number;

	@IntegerFKIDColumn({ nullable: false })
	programId: number;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_ard_academic_period_id',
	})
	academicPeriod: AcademicPeriodEntity;

	@ManyToOne(() => CampusEntity)
	@JoinColumn({ name: 'campus_id', foreignKeyConstraintName: 'FK_ard_campus_id' })
	campus: CampusEntity;

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id', foreignKeyConstraintName: 'FK_ard_program_id' })
	program: ProgramEntity;
}

@Entity({ name: 'ard_detail', schema: 'evidence' })
@Unique('UQ_ard_detail_ard_student_course_professor', [
	'ardId',
	'enrollmentStudentId',
	'courseId',
	'professorId',
])
export class ArdDetailEntity extends BaseEntity {
	@IntegerFKIDColumn({ nullable: false })
	ardId: number;

	@IntegerFKIDColumn({ nullable: false })
	enrollmentStudentId: number;

	@IntegerFKIDColumn({ nullable: false })
	courseId: number;

	@IntegerFKIDColumn({ nullable: false })
	professorId: number;

	@JsonColumn({ nullable: false })
	comments: I18nText;

	@ManyToOne(() => ArdEntity)
	@JoinColumn({
		name: 'ard_id',
		foreignKeyConstraintName: 'FK_ard_detail_ard_id',
	})
	ard: ArdEntity;

	@ManyToOne(() => EnrolledStudentEntity)
	@JoinColumn({
		name: 'enrollment_student_id',
		foreignKeyConstraintName: 'FK_ard_detail_enrollment_student_id',
	})
	enrollmentStudent: EnrolledStudentEntity;

	@ManyToOne(() => CourseEntity)
	@JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'FK_ard_detail_course_id' })
	course: CourseEntity;

	@ManyToOne(() => ProfessorEntity)
	@JoinColumn({
		name: 'professor_id',
		foreignKeyConstraintName: 'FK_ard_detail_professor_id',
	})
	professor: ProfessorEntity;
}
