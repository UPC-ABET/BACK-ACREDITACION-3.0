import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';

@Entity({ name: 'charts', schema: 'organization' })
export class ChartEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	staffId: number;

	@IntegerFKIDColumn({ nullable: false })
	academicPeriodId: number;

	@IntegerFKIDColumn({ nullable: false })
	levelTypeId: number;

	@IntegerColumn({ nullable: true })
	rootChartId: number | null;

	@JsonColumn({ nullable: false })
	title: I18nText;

	@IntegerColumn({ nullable: true })
	entityTypeId: number | null;

	@IntegerColumn({ nullable: true })
	entityCode: number | null;

	@IntegerFKIDColumn({ nullable: true })
	uploadLogId: number;

	// %% RELATIONS

	@ManyToOne(() => StaffEntity)
	@JoinColumn({ name: 'staff_id', foreignKeyConstraintName: 'FK_charts_staff_id' })
	staff: StaffEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_charts_academic_period_id',
	})
	academicPeriod: AcademicPeriodEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'level_type_id', foreignKeyConstraintName: 'FK_charts_level_type_id' })
	levelType: TypeEntity;
}
