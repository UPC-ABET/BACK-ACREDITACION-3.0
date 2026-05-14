import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'chart_levels', schema: 'organization' })
export class ChartLevelEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerColumn({ nullable: false })
	level: number;

	@IntegerColumn({ nullable: false })
	level_type_id: number;

	// %% RELACIONES
}
