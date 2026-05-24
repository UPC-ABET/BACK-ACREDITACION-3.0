import { Entity, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, DateColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { RubricScoreEntity } from 'src/modules/evaluation/rubric-scores/model/rubric-scores.entity';

@Entity({ name: 'evaluations', schema: 'evidence' })
export class EvaluationEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	project_student_id: number;

	@IntegerFKIDColumn({ nullable: false })
	project_evaluator_id: number;

	@IntegerFKIDColumn({ nullable: false })
	qualification_status_type_id: number;

	@JsonColumn({ nullable: true })
	observation: I18nText | null;

	@DateColumn({ nullable: true })
	register_at: Date | null;

	// %% RELATIONS

	@ManyToOne(() => ProjectStudentEntity)
	@JoinColumn({ name: 'project_student_id' })
	project_student: ProjectStudentEntity;

	@ManyToOne(() => ProjectEvaluatorEntity)
	@JoinColumn({ name: 'project_evaluator_id' })
	project_evaluator: ProjectEvaluatorEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'qualification_status_type_id' })
	qualification_status_type: TypeEntity;

	@OneToMany(() => RubricScoreEntity, (score) => score.evaluation, { cascade: true, eager: false })
	scores: RubricScoreEntity[];
}
