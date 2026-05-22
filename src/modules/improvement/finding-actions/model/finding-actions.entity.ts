import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, BooleanColumn, JsonColumn } from 'src/commons/configs/db.configs';
import { ActionEntity } from 'src/modules/improvement/actions/model/actions.entity';
import { FindingEntity } from 'src/modules/improvement/findings/model/findings.entity';
import type { I18nText } from 'src/shared/types/i18n';

@Entity({ name: 'finding_actions', schema: 'improvement' })
export class FindingActionEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	finding_id: number;

	@IntegerFKIDColumn({ nullable: false })
	action_id: number;

	@BooleanColumn({ nullable: false, default: false })
	in_plan_required: boolean;

	@JsonColumn({ nullable: true })
	evidences: I18nText | null;

	// %% RELACIONES

	@ManyToOne(() => FindingEntity)
	@JoinColumn({ name: 'finding_id' })
	finding: FindingEntity;

	@ManyToOne(() => ActionEntity)
	@JoinColumn({ name: 'action_id' })
	action: ActionEntity;
}
