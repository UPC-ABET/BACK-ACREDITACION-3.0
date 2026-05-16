import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { ProjectEntity } from 'src/modules/evaluation/projects/model/projects.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'project_students', schema: 'evaluation' })
export class ProjectStudentEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	project_id: number;

	@IntegerFKIDColumn({ nullable: false })
	student_section_enrollment_id: number;

	@IntegerFKIDColumn({ nullable: false })
	evaluator_type_id: number;

	// %% RELACIONES

	@ManyToOne(() => ProjectEntity)
	@JoinColumn({ name: 'project_id' })
	project: ProjectEntity;

	@ManyToOne(() => StudentSectionEnrollmentEntity)
	@JoinColumn({ name: 'student_section_enrollment_id' })
	student_section_enrollment: StudentSectionEnrollmentEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'evaluator_type_id' })
	evaluator_type: TypeEntity;
}
