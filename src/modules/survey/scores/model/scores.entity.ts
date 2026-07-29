import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	IntegerFKIDColumn,
	DecimalColumn,
	JsonColumn,
	BooleanColumn,
	TextShortColumn,
} from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { ProgramCommissionEntity } from 'src/modules/accreditation/program-commissions/model/program-commissions.entity';

@Entity({ name: 'scores', schema: 'survey' })
export class ScoreEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	surveyId: number;

	@IntegerFKIDColumn({ nullable: false })
	outcomeId: number;

	@DecimalColumn({ nullable: false })
	score: number;

	@JsonColumn({ nullable: true })
	commentaries: I18nText;

	/** false: answered directly. true: derived from `source_program_commission_id`'s scores via
	 *  `accreditation.outcome_conversions.formula` — see ProcessedRvGradeEntity for the pattern
	 *  this mirrors. */
	@BooleanColumn({ nullable: false, withDefault: true, default: false })
	isConverted: boolean;

	@IntegerFKIDColumn({ nullable: true })
	sourceProgramCommissionId: number | null;

	@TextShortColumn({ nullable: true })
	formula: string | null;

	// %% RELATIONS

	@ManyToOne(() => SurveyEntity)
	@JoinColumn({ name: 'survey_id', foreignKeyConstraintName: 'FK_scores_survey_id' })
	survey: SurveyEntity;

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({ name: 'outcome_id', foreignKeyConstraintName: 'FK_scores_outcome_id' })
	outcome: OutcomeEntity;

	@ManyToOne(() => ProgramCommissionEntity)
	@JoinColumn({
		name: 'source_program_commission_id',
		foreignKeyConstraintName: 'FK_scores_source_program_commission_id',
	})
	sourceProgramCommission: ProgramCommissionEntity;
}
