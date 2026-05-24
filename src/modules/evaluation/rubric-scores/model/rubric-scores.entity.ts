import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, DecimalColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { EvaluationEntity } from 'src/modules/evidence/evaluations/model/evaluations.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';

@Entity({ name: 'rubric_scores', schema: 'evaluation' })
export class RubricScoreEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	evaluation_id: number;

	@IntegerFKIDColumn({ nullable: false })
	rubric_question_criteria_id: number;

	@DecimalColumn({ nullable: false })
	score: number;

	@JsonColumn({ nullable: true })
	commentaries: I18nText;

	// %% RELATIONS

	@ManyToOne(() => EvaluationEntity)
	@JoinColumn({ name: 'evaluation_id' })
	evaluation: EvaluationEntity;

	@ManyToOne(() => RubricQuestionCriteriaEntity)
	@JoinColumn({ name: 'rubric_question_criteria_id' })
	rubric_question_criteria: RubricQuestionCriteriaEntity;
}
