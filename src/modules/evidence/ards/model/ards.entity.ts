import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	CodeColumn,
	DateColumn,
	IntegerFKIDColumn,
	TextLargeColumn,
} from 'src/commons/configs/db.configs';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { CourseEntity } from 'src/modules/academic/courses/model/courses.entity';
import { EnrolledStudentEntity } from 'src/modules/academic/enrolled-students/model/enrolled-students.entity';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';

@Entity({ name: 'ard', schema: 'evidence' })
@Unique('UQ_ard_code', ['code'])
export class ArdEntity extends BaseEntity {
	@CodeColumn({ nullable: false, unique: false })
	code: string;

	@DateColumn({ nullable: false })
	meetingDate: Date;

	@IntegerFKIDColumn({ nullable: false })
	academicPeriodId: number;

	@IntegerFKIDColumn({ nullable: false })
	campusId: number;

	@IntegerFKIDColumn({ nullable: true })
	programId: number | null;

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
	program: ProgramEntity | null;
}

@Entity({ name: 'ard_detail', schema: 'evidence' })
export class ArdDetailEntity extends BaseEntity {
	@IntegerFKIDColumn({ nullable: false })
	ardId: number;

	@IntegerFKIDColumn({ nullable: true })
	enrollmentStudentId: number | null;

	@IntegerFKIDColumn({ nullable: false })
	courseId: number;

	@IntegerFKIDColumn({ nullable: false })
	professorId: number;

	@TextLargeColumn({ nullable: true })
	comments: string | null;

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
	enrollmentStudent: EnrolledStudentEntity | null;

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
