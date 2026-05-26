import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { FindingActionEntity } from 'src/modules/improvement/finding-actions/model/finding-actions.entity';
import { PlanEntity } from 'src/modules/improvement/plans/model/plans.entity';

@Entity({ name: 'plan_actions', schema: 'improvement' })
export class PlanActionEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	plan_id: number;

	@IntegerFKIDColumn({ nullable: false })
	finding_action_id: number;

	// %% RELATIONS

	@ManyToOne(() => PlanEntity)
	@JoinColumn({ name: 'plan_id', foreignKeyConstraintName: 'FK_plan_actions_plan_id' })
	plan: PlanEntity;

	@ManyToOne(() => FindingActionEntity)
	@JoinColumn({
		name: 'finding_action_id',
		foreignKeyConstraintName: 'FK_plan_actions_finding_action_id',
	})
	finding_action: FindingActionEntity;
}
