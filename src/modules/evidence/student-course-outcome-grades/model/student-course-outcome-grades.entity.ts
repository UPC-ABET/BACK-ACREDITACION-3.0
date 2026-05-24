import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, DecimalColumn } from 'src/commons/configs/db.configs';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';

@Entity({ name: 'student_course_outcome_grades', schema: 'evidence' })
export class StudentCourseOutcomeGradeEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	student_section_enrollment_id: number;

	@IntegerFKIDColumn({ nullable: false })
	outcome_id: number;

	@DecimalColumn({ nullable: false })
	grade: number;

	// %% RELATIONS

	@ManyToOne(() => StudentSectionEnrollmentEntity)
	@JoinColumn({ name: 'student_section_enrollment_id' })
	student_section_enrollment: StudentSectionEnrollmentEntity;

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({ name: 'outcome_id' })
	outcome: OutcomeEntity;
}
