import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { ChartLevelEntity } from 'src/modules/organization/chart-levels/model/chart-levels.entity';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';

@Entity({ name: 'charts', schema: 'organization' })
export class ChartEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	staff_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	@IntegerFKIDColumn({ nullable: false })
	chart_level_id: number;

	@IntegerColumn({ nullable: true })
	root_chart_detail_id: number | null;

	@JsonColumn({ nullable: false })
	level_title: I18nText;

	@IntegerColumn({ nullable: true })
	entity_type_id: number | null;

	@IntegerColumn({ nullable: true })
	entity_code: number | null;

	// %% RELACIONES

	@ManyToOne(() => StaffEntity)
	@JoinColumn({ name: 'staff_id' })
	staff: StaffEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id' })
	academic_period: AcademicPeriodEntity;

	@ManyToOne(() => ChartLevelEntity)
	@JoinColumn({ name: 'chart_level_id' })
	chart_level: ChartLevelEntity;
}
