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
	programId: number;

	@IntegerFKIDColumn({ nullable: false })
	academicPeriodId: number;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: true })
	description: I18nText;

	@BooleanColumn({ nullable: false, default: false })
	isOpen: boolean;

	// %% RELATIONS

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id', foreignKeyConstraintName: 'FK_plans_program_id' })
	program: ProgramEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_plans_academic_period_id',
	})
	academicPeriod: AcademicPeriodEntity;
}
