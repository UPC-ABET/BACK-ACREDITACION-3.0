import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { CourseSectionEntity } from 'src/modules/academic/course-sections/model/course-sections.entity';
import { EnrolledStudentEntity } from 'src/modules/academic/enrolled-students/model/enrolled-students.entity';

@Entity({ name: 'student_section_enrollments', schema: 'academic' })
export class StudentSectionEnrollmentEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	enrolledStudentId: number;

	@IntegerFKIDColumn({ nullable: false })
	courseSectionId: number;

	// %% RELATIONS

	@ManyToOne(() => EnrolledStudentEntity)
	@JoinColumn({
		name: 'enrolled_student_id',
		foreignKeyConstraintName: 'FK_student_section_enrollments_enrolled_student_id',
	})
	enrolledStudent: EnrolledStudentEntity;

	@ManyToOne(() => CourseSectionEntity)
	@JoinColumn({
		name: 'course_section_id',
		foreignKeyConstraintName: 'FK_student_section_enrollments_course_section_id',
	})
	courseSection: CourseSectionEntity;
}
