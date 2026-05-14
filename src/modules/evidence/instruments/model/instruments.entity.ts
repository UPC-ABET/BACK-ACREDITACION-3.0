import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, CodeColumn, TextMediumColumn, IntegerColumn, BooleanColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'instruments', schema: 'evidence' })
export class InstrumentEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerColumn({ nullable: false })
	constituent_type_id: number;

	@CodeColumn({ nullable: false, unique: true })
	code: string;

	@NameColumn({ nullable: false })
	name: string;

	@TextMediumColumn({ nullable: true })
	description: string;

	@BooleanColumn({ nullable: false, default: true })
	is_for_accreditation: boolean;

	// %% RELACIONES
}
