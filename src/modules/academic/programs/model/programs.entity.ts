import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, CodeColumn, IntegerColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'programs', schema: 'academic' })
export class ProgramEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerColumn({ nullable: false })
	modality_type_id: number;

	@CodeColumn({ nullable: false })
	code: string;

	@NameColumn({ nullable: false })
	name: string;

	@NameColumn({ nullable: false })
	degree: string;

	// %% RELACIONES
}
