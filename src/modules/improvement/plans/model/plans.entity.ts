import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, BooleanColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';

@Entity({ name: 'plans', schema: 'improvement' })
export class PlanEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	program_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: true })
	description: I18nText;

	@BooleanColumn({ nullable: false, default: false })
	is_open: boolean;

	// %% RELATIONS

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id' })
	program: ProgramEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id' })
	academic_period: AcademicPeriodEntity;
}
