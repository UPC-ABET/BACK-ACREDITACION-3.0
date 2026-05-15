import { Entity, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';

@Entity({ name: 'rubric_questions', schema: 'evaluation' })
export class RubricQuestionEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	rubric_id: number;

	@IntegerFKIDColumn({ nullable: true })
	outcome_id?: number;

	@JsonColumn({ nullable: false })
	question: I18nText;

	// %% RELACIONES

	@ManyToOne(() => RubricEntity, (r) => r.questions)
	@JoinColumn({ name: 'rubric_id' })
	rubric: RubricEntity;

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({ name: 'outcome_id' })
	outcome?: OutcomeEntity;

	@OneToMany(() => RubricQuestionCriteriaEntity, (c) => c.question, { cascade: true, eager: false })
	criterias: RubricQuestionCriteriaEntity[];
}
