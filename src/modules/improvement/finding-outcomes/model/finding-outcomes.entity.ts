import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { FindingEntity } from 'src/modules/improvement/findings/model/findings.entity';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';

@Entity({ name: 'finding_outcomes', schema: 'improvement' })
export class FindingOutcomeEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	finding_id: number;

	@IntegerFKIDColumn({ nullable: false })
	outcome_id: number;

	// %% RELATIONS

	@ManyToOne(() => FindingEntity)
	@JoinColumn({ name: 'finding_id', foreignKeyConstraintName: 'FK_finding_outcomes_finding_id' })
	finding: FindingEntity;

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({ name: 'outcome_id', foreignKeyConstraintName: 'FK_finding_outcomes_outcome_id' })
	outcome: OutcomeEntity;
}
