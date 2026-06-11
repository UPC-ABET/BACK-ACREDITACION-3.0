import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from 'src/commons/base.entity';
import {
	EmailColumn,
	NameColumn,
	PasswordColumn,
	IntegerFKIDColumn,
	IntegerColumn,
} from 'src/commons/configs/db.configs';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'users', schema: 'organization' })
export class UserEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: true })
	documentTypeId: number;

	@IntegerColumn({ nullable: true })
	documentCode: number;

	@NameColumn({ nullable: false })
	firstName: string;

	@NameColumn({ nullable: false })
	lastName: string;

	@EmailColumn({ nullable: false })
	email: string;

	@NameColumn({ nullable: true })
	phone: string;

	@Exclude()
	@PasswordColumn({ nullable: false })
	password: string;

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'document_type_id', foreignKeyConstraintName: 'FK_users_document_type_id' })
	documentType: TypeEntity;
}
