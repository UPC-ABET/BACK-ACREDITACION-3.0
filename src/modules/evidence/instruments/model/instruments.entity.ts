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
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	constituentTypeId: number;

	@CodeColumn({ nullable: false, unique: true })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: true })
	description: I18nText;

	@BooleanColumn({ nullable: false, default: true })
	isForAccreditation: boolean;

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'constituent_type_id',
		foreignKeyConstraintName: 'FK_instruments_constituent_type_id',
	})
	constituentType: TypeEntity;
}
