import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, DecimalColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { RubricScaleEntity } from 'src/modules/evaluation/rubric-scales/model/rubric-scales.entity';

@Entity({ name: 'rubric_question_criterias', schema: 'evaluation' })
export class RubricQuestionCriteriaEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	rubric_question_id: number;

	@IntegerFKIDColumn({ nullable: false })
	rubric_scale_id: number;

	@JsonColumn({ nullable: false })
	criteria: I18nText;

	@DecimalColumn({ nullable: false })
	min_value: number;

	@DecimalColumn({ nullable: false })
	max_value: number;

	// %% RELACIONES

	@ManyToOne(() => RubricQuestionEntity)
	@JoinColumn({ name: 'rubric_question_id' })
	rubric_question: RubricQuestionEntity;

	@ManyToOne(() => RubricScaleEntity)
	@JoinColumn({ name: 'rubric_scale_id' })
	rubric_scale: RubricScaleEntity;
}
