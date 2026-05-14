import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { TextMediumColumn, IntegerFKIDColumn, IntegerColumn } from 'src/commons/configs/db.configs';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';

@Entity({ name: 'actions', schema: 'improvement' })
export class ActionEntity extends BaseEntity {
	// %% ATRIBUTOS

	@TextMediumColumn({ nullable: false })
	description: string;

	@IntegerColumn({ nullable: false })
	correlative: number;

	@IntegerColumn({ nullable: false })
	action_status_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	program_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	// %% RELACIONES

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id' })
	program: ProgramEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id' })
	academic_period: AcademicPeriodEntity;
}
