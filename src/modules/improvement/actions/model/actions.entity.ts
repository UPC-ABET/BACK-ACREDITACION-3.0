import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';

@Entity({ name: 'actions', schema: 'improvement' })
export class ActionEntity extends BaseEntity {
	// %% ATTRIBUTES

	@JsonColumn({ nullable: false })
	description: I18nText;

	@IntegerColumn({ nullable: false })
	correlative: number;

	@IntegerFKIDColumn({ nullable: false })
	program_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	// %% RELATIONS

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id', foreignKeyConstraintName: 'FK_actions_program_id' })
	program: ProgramEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_actions_academic_period_id',
	})
	academic_period: AcademicPeriodEntity;
}
