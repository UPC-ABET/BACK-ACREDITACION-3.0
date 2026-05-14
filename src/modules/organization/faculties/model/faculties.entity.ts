import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, CodeColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'faculties', schema: 'organization' })
export class FacultyEntity extends BaseEntity {
	// %% ATRIBUTOS

	@CodeColumn({ nullable: false })
	code: string;

	@NameColumn({ nullable: false })
	name: string;

	// %% RELACIONES
}
