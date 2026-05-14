import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, CodeColumn, IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { AccreditorEntity } from 'src/modules/accreditation/accreditors/model/accreditors.entity';

@Entity({ name: 'commissions', schema: 'accreditation' })
export class CommissionEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	accreditor_id: number;

	@CodeColumn({ nullable: false })
	code: string;

	@NameColumn({ nullable: false })
	name: string;

	// %% RELACIONES

	@ManyToOne(() => AccreditorEntity)
	@JoinColumn({ name: 'accreditor_id' })
	accreditor: AccreditorEntity;
}
