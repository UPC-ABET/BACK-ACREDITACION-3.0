import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';

@Entity({ name: 'roles', schema: 'core' })
export class RoleEntity extends BaseEntity {
	// %% ATTRIBUTES

	@JsonColumn({ nullable: false })
	name: I18nText;

	@CodeColumn({ nullable: false })
	code: string;

	@JsonColumn({ nullable: true })
	description: I18nText;

	// %% RELATIONS
}
