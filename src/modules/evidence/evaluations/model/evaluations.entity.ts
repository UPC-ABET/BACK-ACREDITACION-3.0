import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn, DateColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';

@Entity({ name: 'evaluations', schema: 'evidence' })
export class EvaluationEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	project_student_id: number;

	@IntegerFKIDColumn({ nullable: false })
	project_evaluator_id: number;

	@IntegerColumn({ nullable: false })
	qualification_status_type_id: number;

	@JsonColumn({ nullable: true })
	observation: I18nText;

	@DateColumn({ nullable: true })
	register_at: Date;

	// %% RELACIONES

	@ManyToOne(() => ProjectStudentEntity)
	@JoinColumn({ name: 'project_student_id' })
	project_student: ProjectStudentEntity;

	@ManyToOne(() => ProjectEvaluatorEntity)
	@JoinColumn({ name: 'project_evaluator_id' })
	project_evaluator: ProjectEvaluatorEntity;
}
