import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { TextLargeColumn, IntegerFKIDColumn, DecimalColumn } from 'src/commons/configs/db.configs';
import { EvaluationEntity } from 'src/modules/evidence/evaluations/model/evaluations.entity';
import { RubricOutcomeCriteriaEntity } from 'src/modules/evaluation/rubric-outcome-criterias/model/rubric-outcome-criterias.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';

@Entity({ name: 'rubric_scores', schema: 'evaluation' })
export class RubricScoreEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	evaluation_id: number;

	@IntegerFKIDColumn({ nullable: false })
	rubric_outcome_criteria_id: number;

	@IntegerFKIDColumn({ nullable: false })
	rubric_question_criteria_id: number;

	@DecimalColumn({ nullable: false })
	score: number;

	@TextLargeColumn({ nullable: true })
	commentaries: string;

	// %% RELACIONES

	@ManyToOne(() => EvaluationEntity)
	@JoinColumn({ name: 'evaluation_id' })
	evaluation: EvaluationEntity;

	@ManyToOne(() => RubricOutcomeCriteriaEntity)
	@JoinColumn({ name: 'rubric_outcome_criteria_id' })
	rubric_outcome_criteria: RubricOutcomeCriteriaEntity;

	@ManyToOne(() => RubricQuestionCriteriaEntity)
	@JoinColumn({ name: 'rubric_question_criteria_id' })
	rubric_question_criteria: RubricQuestionCriteriaEntity;
}
