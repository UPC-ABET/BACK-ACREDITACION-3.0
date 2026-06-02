import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { ProgramCommissionEntity } from 'src/modules/accreditation/program-commissions/model/program-commissions.entity';

@Entity({ name: 'outcomes', schema: 'accreditation' })
export class OutcomeEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	programCommissionId: number;

	@CodeColumn({ nullable: false, unique: false })
	outcomeCode: string;

	@JsonColumn({ nullable: false })
	outcomeName: I18nText;

	@JsonColumn({ nullable: false })
	outcomeDescription: I18nText;

	@IntegerFKIDColumn({ nullable: true })
	uploadLogId: number;

	// %% RELATIONS

	@ManyToOne(() => ProgramCommissionEntity)
	@JoinColumn({
		name: 'program_commission_id',
		foreignKeyConstraintName: 'FK_outcomes_program_commission_id',
	})
	programCommission: ProgramCommissionEntity;
}
