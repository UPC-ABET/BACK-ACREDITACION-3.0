import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';

@Entity({ name: 'rubric_questions', schema: 'evaluation' })
export class RubricQuestionEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	rubric_id: number;

	@IntegerFKIDColumn({ nullable: false })
	outcome_id: number;

	@JsonColumn({ nullable: false })
	question: I18nText;

	// %% RELACIONES

	@ManyToOne(() => RubricEntity)
	@JoinColumn({ name: 'rubric_id' })
	rubric: RubricEntity;

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({ name: 'outcome_id' })
	outcome: OutcomeEntity;
}
