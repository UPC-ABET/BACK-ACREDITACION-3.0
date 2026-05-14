import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, CodeColumn, TextMediumColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'projects', schema: 'evaluation' })
export class ProjectEntity extends BaseEntity {
	// %% ATRIBUTOS

	@CodeColumn({ nullable: false, unique: true })
	code: string;

	@NameColumn({ nullable: false })
	name: string;

	@TextMediumColumn({ nullable: true })
	description: string;

	// %% RELACIONES
}
