import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, TextMediumColumn, TextFullColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'courses', schema: 'academic' })
export class CourseEntity extends BaseEntity {
	// %% ATRIBUTOS

	@NameColumn({ nullable: false })
	name: string;

	@TextMediumColumn({ nullable: false })
	description: string;

	@TextFullColumn({ nullable: false })
	learning_outcome: string;

	// %% RELACIONES
}
