import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, DecimalColumn } from 'src/commons/configs/db.configs';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';

@Entity({ name: 'student_course_outcome_grades', schema: 'evidence' })
export class StudentCourseOutcomeGradeEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	studentSectionEnrollmentId: number;

	@IntegerFKIDColumn({ nullable: false })
	outcomeId: number;

	@DecimalColumn({ nullable: false })
	grade: number;

	// %% RELATIONS

	@ManyToOne(() => StudentSectionEnrollmentEntity)
	@JoinColumn({
		name: 'student_section_enrollment_id',
		foreignKeyConstraintName: 'FK_student_course_outcome_grades_student_section_enrollment_id',
	})
	studentSectionEnrollment: StudentSectionEnrollmentEntity;

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({
		name: 'outcome_id',
		foreignKeyConstraintName: 'FK_student_course_outcome_grades_outcome_id',
	})
	outcome: OutcomeEntity;
}
