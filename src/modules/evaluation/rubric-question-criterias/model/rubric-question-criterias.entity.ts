import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { DecimalColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';

@Entity({ name: 'rubric_question_criterias', schema: 'evaluation' })
export class RubricQuestionCriteriaEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	rubricQuestionId: number;

	@JsonColumn({ nullable: false })
	criteria: I18nText;

	@DecimalColumn({ nullable: false })
	minValue: number;

	@DecimalColumn({ nullable: false })
	maxValue: number;

	// %% RELATIONS

	@ManyToOne(() => RubricQuestionEntity, (q) => q.criterias)
	@JoinColumn({
		name: 'rubric_question_id',
		foreignKeyConstraintName: 'FK_rubric_question_criterias_rubric_question_id',
	})
	question: RubricQuestionEntity;
}
