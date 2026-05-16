import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { CommissionEntity } from 'src/modules/accreditation/commissions/model/commissions.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'program_commissions', schema: 'accreditation' })
export class ProgramCommissionEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	commission_id: number;

	@IntegerFKIDColumn({ nullable: false })
	program_id: number;

	@IntegerFKIDColumn({ nullable: false })
	academic_period_id: number;

	@IntegerFKIDColumn({ nullable: false })
	commission_type_id: number;

	// %% RELACIONES

	@ManyToOne(() => CommissionEntity)
	@JoinColumn({ name: 'commission_id' })
	commission: CommissionEntity;

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id' })
	program: ProgramEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id' })
	academic_period: AcademicPeriodEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'commission_type_id' })
	commission_type: TypeEntity;
}
