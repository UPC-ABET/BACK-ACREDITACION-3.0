import { Entity, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { SchoolEntity } from 'src/modules/organization/schools/model/schools.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'notification_configs', schema: 'ifc' })
@Unique('UQ_4689ce4c54254910a1e7ab56b1c', ['school_id', 'academic_period_id', 'trigger_event_id', 'ifc_status_type_id'])
export class NotificationConfigEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	school_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	@IntegerFKIDColumn({ nullable: false })
	trigger_event_id: number;

	@IntegerFKIDColumn({ nullable: false })
	ifc_status_type_id: number;

	@JsonColumn({ nullable: false })
	title: I18nText;

	@JsonColumn({ nullable: false })
	body: I18nText;

	@JsonColumn({ nullable: false })
	to_chart_level_type_ids: string[];

	@JsonColumn({ nullable: false })
	cc_chart_level_type_ids: string[];

	// %% RELACIONES

	@ManyToOne(() => SchoolEntity)
	@JoinColumn({ name: 'school_id' })
	school: SchoolEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id' })
	academic_period: AcademicPeriodEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'ifc_status_type_id' })
	ifc_status_type: TypeEntity;
}
