import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, CodeColumn, TextMediumColumn, JsonColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'parameters', schema: 'core' })
export class ParameterEntity extends BaseEntity {
	// %% ATRIBUTOS

	@CodeColumn({ nullable: false })
	code: string;

	@NameColumn({ nullable: false })
	name: string;

	@TextMediumColumn({ nullable: true })
	description: string;

	@JsonColumn({ nullable: true })
	value: any;

	// %% RELACIONES
}
