import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	CodeColumn,
	IntegerFKIDColumn,
	BooleanColumn,
	JsonColumn,
} from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'instruments', schema: 'evidence' })
export class InstrumentEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	constituent_type_id: number;

	@CodeColumn({ nullable: false, unique: true })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: true })
	description: I18nText;

	@BooleanColumn({ nullable: false, default: true })
	is_for_accreditation: boolean;

	// %% RELACIONES

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'constituent_type_id' })
	constituent_type: TypeEntity;
}
