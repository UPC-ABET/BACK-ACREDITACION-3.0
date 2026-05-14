import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, CodeColumn, TextMediumColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'type_groups', schema: 'core' })
export class TypeGroupEntity extends BaseEntity {
	// %% ATRIBUTOS

	@CodeColumn({ nullable: false })
	code: string;

	@NameColumn({ nullable: false })
	name: string;

	@TextMediumColumn({ nullable: true })
	description: string;

	// %% RELACIONES
}
