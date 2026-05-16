import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AccreditorEntity } from 'src/modules/accreditation/accreditors/model/accreditors.entity';

@Entity({ name: 'commissions', schema: 'accreditation' })
export class CommissionEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	accreditor_id: number;

	@CodeColumn({ nullable: false })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	// %% RELACIONES

	@ManyToOne(() => AccreditorEntity)
	@JoinColumn({ name: 'accreditor_id' })
	accreditor: AccreditorEntity;
}
