import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, CodeColumn, TextMediumColumn, IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { TypeGroupEntity } from 'src/modules/core/type-groups/model/type-groups.entity';

@Entity({ name: 'types', schema: 'core' })
export class TypeEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	type_group_id: string;

	@CodeColumn({ nullable: false })
	code: string;

	@NameColumn({ nullable: false })
	name: string;

	@TextMediumColumn({ nullable: true })
	description: string;

	// %% RELACIONES

	@ManyToOne(() => TypeGroupEntity)
	@JoinColumn({ name: 'type_group_id' })
	type_group: TypeGroupEntity;
}
