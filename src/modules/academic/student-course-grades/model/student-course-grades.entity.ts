import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, DecimalColumn } from 'src/commons/configs/db.configs';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'student_course_grades', schema: 'academic' })
export class StudentCourseGradeEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	student_section_enrollment_id: number;

	@IntegerFKIDColumn({ nullable: false })
	grade_type_id: number;

	@DecimalColumn({ nullable: false })
	grade_type_percentage: number;

	@DecimalColumn({ nullable: false })
	grade: number;

	// %% RELATIONS

	@ManyToOne(() => StudentSectionEnrollmentEntity)
	@JoinColumn({ name: 'student_section_enrollment_id' })
	student_section_enrollment: StudentSectionEnrollmentEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'grade_type_id' })
	grade_type: TypeEntity;
}
