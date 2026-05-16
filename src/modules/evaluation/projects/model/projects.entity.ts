import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';

@Entity({ name: 'projects', schema: 'evaluation' })
export class ProjectEntity extends BaseEntity {
	// %% ATRIBUTOS

	@CodeColumn({ nullable: false, unique: true })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: true })
	description: I18nText;

	// %% RELACIONES
}
