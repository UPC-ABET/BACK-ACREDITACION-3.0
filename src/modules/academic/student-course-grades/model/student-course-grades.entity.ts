import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, DecimalColumn } from 'src/commons/configs/db.configs';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'student_course_grades', schema: 'academic' })
export class StudentCourseGradeEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	studentSectionEnrollmentId: number;

	@IntegerFKIDColumn({ nullable: false })
	gradeTypeId: number;

	@DecimalColumn({ nullable: false })
	gradeTypePercentage: number;

	@DecimalColumn({ nullable: false })
	grade: number;

	@IntegerFKIDColumn({ nullable: true })
	uploadLogId: number;

	// %% RELATIONS

	@ManyToOne(() => StudentSectionEnrollmentEntity)
	@JoinColumn({
		name: 'student_section_enrollment_id',
		foreignKeyConstraintName: 'FK_student_course_grades_student_section_enrollment_id',
	})
	studentSectionEnrollment: StudentSectionEnrollmentEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'grade_type_id',
		foreignKeyConstraintName: 'FK_student_course_grades_grade_type_id',
	})
	gradeType: TypeEntity;
}
