import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { TypeGroupEntity } from 'src/modules/core/type-groups/model/type-groups.entity';

@Entity({ name: 'types', schema: 'core' })
export class TypeEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	type_group_id: number;

	@CodeColumn({ nullable: false })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: true })
	description: I18nText;

	// %% RELATIONS

	@ManyToOne(() => TypeGroupEntity)
	@JoinColumn({ name: 'type_group_id', foreignKeyConstraintName: 'FK_types_type_group_id' })
	type_group: TypeGroupEntity;
}
