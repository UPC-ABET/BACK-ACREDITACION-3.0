import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { DecimalColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';

@Entity({ name: 'rubric_question_criterias', schema: 'evaluation' })
export class RubricQuestionCriteriaEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	rubric_question_id: number;

	@JsonColumn({ nullable: false })
	criteria: I18nText;

	@DecimalColumn({ nullable: false })
	min_value: number;

	@DecimalColumn({ nullable: false })
	max_value: number;

	// %% RELACIONES

	@ManyToOne(() => RubricQuestionEntity, (q) => q.criterias)
	@JoinColumn({ name: 'rubric_question_id' })
	question: RubricQuestionEntity;
}
