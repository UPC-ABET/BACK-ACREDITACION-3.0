import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, TextLargeColumn, IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';

@Entity({ name: 'outcome_configs', schema: 'survey' })
export class OutcomeConfigEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	outcome_id: number;

	@NameColumn({ nullable: false })
	user_outcome_name: string;

	@TextLargeColumn({ nullable: true })
	user_outcome_description: string;

	// %% RELACIONES

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({ name: 'outcome_id' })
	outcome: OutcomeEntity;
}
