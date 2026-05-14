import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, CodeColumn, IntegerFKIDColumn, IntegerColumn, DecimalColumn } from 'src/commons/configs/db.configs';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';

@Entity({ name: 'performance_levels', schema: 'academic' })
export class PerformanceLevelEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerColumn({ nullable: false })
	instrument_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	@NameColumn({ nullable: false })
	name: string;

	@CodeColumn({ nullable: false })
	code: string;

	@DecimalColumn({ nullable: false })
	unique_value: number;

	@DecimalColumn({ nullable: false })
	min_score: number;

	@DecimalColumn({ nullable: false })
	max_score: number;

	@DecimalColumn({ nullable: false })
	max_value: number;

	// %% RELACIONES

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id' })
	academic_period: AcademicPeriodEntity;
}
