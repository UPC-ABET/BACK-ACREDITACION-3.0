import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn } from 'src/commons/configs/db.configs';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'chart_levels', schema: 'organization' })
export class ChartLevelEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerColumn({ nullable: false })
	level: number;

	@IntegerFKIDColumn({ nullable: false })
	level_type_id: number;

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'level_type_id', foreignKeyConstraintName: 'FK_chart_levels_level_type_id' })
	level_type: TypeEntity;
}
