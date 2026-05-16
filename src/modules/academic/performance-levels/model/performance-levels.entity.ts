import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, DecimalColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'performance_levels', schema: 'academic' })
export class PerformanceLevelEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	instrument_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	@JsonColumn({ nullable: false })
	name: I18nText;

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

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'instrument_type_id' })
	instrument_type: TypeEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id' })
	academic_period: AcademicPeriodEntity;
}
