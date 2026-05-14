import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'accreditors', schema: 'accreditation' })
export class AccreditorEntity extends BaseEntity {
	// %% ATRIBUTOS

	@NameColumn({ nullable: false })
	code: string;

	@NameColumn({ nullable: false })
	name: string;

	// %% RELACIONES
}
