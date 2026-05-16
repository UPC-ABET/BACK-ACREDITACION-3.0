import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerColumn, DecimalColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';

@Entity({ name: 'rubric_question_criterias', schema: 'evaluation' })
export class RubricQuestionCriteriaEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerColumn({ nullable: false })
	rubric_question_id: number;

	@IntegerColumn({ nullable: false })
	rubric_scale_id: number;

	@JsonColumn({ nullable: false })
	criteria: I18nText;

	@DecimalColumn({ nullable: false })
	min_value: number;

	@DecimalColumn({ nullable: false })
	max_value: number;

	// %% RELACIONES
}
