import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	CodeColumn,
	IntegerFKIDColumn,
	DecimalColumn,
	JsonColumn,
} from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'performance_levels', schema: 'academic' })
export class PerformanceLevelEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	instrumentTypeId: number;

	@IntegerFKIDColumn({ nullable: false })
	academicPeriodId: number;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@CodeColumn({ nullable: false })
	code: string;

	@DecimalColumn({ nullable: false })
	uniqueValue: number;

	@DecimalColumn({ nullable: false })
	minScore: number;

	@DecimalColumn({ nullable: false })
	maxScore: number;

	@DecimalColumn({ nullable: false })
	maxValue: number;

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'instrument_type_id',
		foreignKeyConstraintName: 'FK_performance_levels_instrument_type_id',
	})
	instrumentType: TypeEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_performance_levels_academic_period_id',
	})
	academicPeriod: AcademicPeriodEntity;
}
