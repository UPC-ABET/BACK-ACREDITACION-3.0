import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';

@Entity({ name: 'outcome_configs', schema: 'survey' })
export class OutcomeConfigEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	outcome_id: number;

	@JsonColumn({ nullable: false })
	user_outcome_name: I18nText;

	@JsonColumn({ nullable: true })
	user_outcome_description: I18nText;

	// %% RELATIONS

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({ name: 'outcome_id' })
	outcome: OutcomeEntity;
}
