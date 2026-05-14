import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn, DecimalColumn } from 'src/commons/configs/db.configs';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';

@Entity({ name: 'student_course_grades', schema: 'academic' })
export class StudentCourseGradeEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	student_section_enrollment_id: number;

	@IntegerColumn({ nullable: false })
	grade_type_id: number;

	@DecimalColumn({ nullable: false })
	grade_type_percentage: number;

	@DecimalColumn({ nullable: false })
	grade: number;

	// %% RELACIONES

	@ManyToOne(() => StudentSectionEnrollmentEntity)
	@JoinColumn({ name: 'student_section_enrollment_id' })
	student_section_enrollment: StudentSectionEnrollmentEntity;
}
