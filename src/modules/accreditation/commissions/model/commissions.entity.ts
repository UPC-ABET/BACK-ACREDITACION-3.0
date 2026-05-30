import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AccreditorEntity } from 'src/modules/accreditation/accreditors/model/accreditors.entity';

@Entity({ name: 'commissions', schema: 'accreditation' })
export class CommissionEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	accreditorId: number;

	@CodeColumn({ nullable: false })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	// %% RELATIONS

	@ManyToOne(() => AccreditorEntity)
	@JoinColumn({ name: 'accreditor_id', foreignKeyConstraintName: 'FK_commissions_accreditor_id' })
	accreditor: AccreditorEntity;
}
