import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'campuses', schema: 'organization' })
export class CampusEntity extends BaseEntity {
	// %% ATRIBUTOS

	@NameColumn({ nullable: false })
	code: string;

	@NameColumn({ nullable: false })
	name: string;

	// %% RELACIONES
}
