import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from 'src/commons/base.entity';
import {
	NameColumn,
	PasswordColumn,
	TextMediumColumn,
	IntegerFKIDColumn,
	IntegerColumn,
	BooleanColumn,
} from 'src/commons/configs/db.configs';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'users', schema: 'organization' })
export class UserEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	document_type_id: number;

	@IntegerColumn({ nullable: false })
	document_code: number;

	@NameColumn({ nullable: false })
	first_name: string;

	@NameColumn({ nullable: false })
	last_name: string;

	@TextMediumColumn({ nullable: false })
	email: string;

	@NameColumn()
	phone: string;

	@Exclude()
	@PasswordColumn({ nullable: false })
	password: string;

	@BooleanColumn()
	is_admin: boolean;

	// %% RELACIONES

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'document_type_id' })
	document_type: TypeEntity;
}
