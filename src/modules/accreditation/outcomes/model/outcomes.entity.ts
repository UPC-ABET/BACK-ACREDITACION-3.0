import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { ProgramCommissionEntity } from 'src/modules/accreditation/program-commissions/model/program-commissions.entity';

@Entity({ name: 'outcomes', schema: 'accreditation' })
export class OutcomeEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	program_commission_id: number;

	@CodeColumn({ nullable: false })
	outcome_code: string;

	@JsonColumn({ nullable: false })
	outcome_name: I18nText;

	@JsonColumn({ nullable: false })
	outcome_description: I18nText;

	// %% RELATIONS

	@ManyToOne(() => ProgramCommissionEntity)
	@JoinColumn({ name: 'program_commission_id', foreignKeyConstraintName: 'FK_outcomes_program_commission_id' })
	program_commission: ProgramCommissionEntity;
}
