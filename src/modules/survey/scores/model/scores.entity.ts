import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, DecimalColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';

@Entity({ name: 'scores', schema: 'survey' })
export class ScoreEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	survey_id: number;

	@IntegerFKIDColumn({ nullable: false })
	outcome_id: number;

	@DecimalColumn({ nullable: false })
	score: number;

	@JsonColumn({ nullable: true })
	commentaries: I18nText;

	// %% RELATIONS

	@ManyToOne(() => SurveyEntity)
	@JoinColumn({ name: 'survey_id' })
	survey: SurveyEntity;

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({ name: 'outcome_id' })
	outcome: OutcomeEntity;
}
