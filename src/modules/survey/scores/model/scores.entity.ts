import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { TextLargeColumn, IntegerFKIDColumn, DecimalColumn } from 'src/commons/configs/db.configs';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';

@Entity({ name: 'scores', schema: 'survey' })
export class ScoreEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	survey_id: number;

	@IntegerFKIDColumn({ nullable: false })
	outcome_id: number;

	@DecimalColumn({ nullable: false })
	score: number;

	@TextLargeColumn({ nullable: true })
	commentaries: string;

	// %% RELACIONES

	@ManyToOne(() => SurveyEntity)
	@JoinColumn({ name: 'survey_id' })
	survey: SurveyEntity;

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({ name: 'outcome_id' })
	outcome: OutcomeEntity;
}
