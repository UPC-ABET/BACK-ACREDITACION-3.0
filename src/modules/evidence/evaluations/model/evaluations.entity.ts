import { Entity, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, DateColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { RubricScoreEntity } from 'src/modules/evaluation/rubric-scores/model/rubric-scores.entity';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';

@Entity({ name: 'evaluations', schema: 'evidence' })
export class EvaluationEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	projectStudentId: number;

	@IntegerFKIDColumn({ nullable: false })
	projectEvaluatorId: number;

	@IntegerFKIDColumn({ nullable: false })
	rubricId: number;

	@IntegerFKIDColumn({ nullable: false })
	qualificationStatusTypeId: number;

	@JsonColumn({ nullable: true })
	observation: I18nText | null;

	@DateColumn({ nullable: true })
	registerAt: Date | null;

	// %% RELATIONS

	@ManyToOne(() => ProjectStudentEntity)
	@JoinColumn({
		name: 'project_student_id',
		foreignKeyConstraintName: 'FK_evaluations_project_student_id',
	})
	projectStudent: ProjectStudentEntity;

	@ManyToOne(() => ProjectEvaluatorEntity)
	@JoinColumn({
		name: 'project_evaluator_id',
		foreignKeyConstraintName: 'FK_evaluations_project_evaluator_id',
	})
	projectEvaluator: ProjectEvaluatorEntity;

	@ManyToOne(() => RubricEntity)
	@JoinColumn({ name: 'rubric_id', foreignKeyConstraintName: 'FK_evaluations_rubric_id' })
	rubric: RubricEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'qualification_status_type_id',
		foreignKeyConstraintName: 'FK_evaluations_qualification_status_type_id',
	})
	qualificationStatusType: TypeEntity;

	@OneToMany(() => RubricScoreEntity, (score) => score.evaluation, { cascade: true, eager: false })
	scores: RubricScoreEntity[];
}
