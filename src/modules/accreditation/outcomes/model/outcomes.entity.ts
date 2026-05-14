import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, CodeColumn, TextLargeColumn, IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { ProgramCommissionEntity } from 'src/modules/accreditation/program-commissions/model/program-commissions.entity';

@Entity({ name: 'outcomes', schema: 'accreditation' })
export class OutcomeEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	program_commission_id: number;

	@CodeColumn({ nullable: false })
	outcome_code: string;

	@NameColumn({ nullable: false })
	outcome_name: string;

	@TextLargeColumn({ nullable: false })
	outcome_description: string;

	// %% RELACIONES

	@ManyToOne(() => ProgramCommissionEntity)
	@JoinColumn({ name: 'program_commission_id' })
	program_commission: ProgramCommissionEntity;
}
