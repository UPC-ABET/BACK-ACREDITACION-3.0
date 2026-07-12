import { Entity, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, TextShortColumn } from 'src/commons/configs/db.configs';
import { ProgramCommissionEntity } from 'src/modules/accreditation/program-commissions/model/program-commissions.entity';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';

/**
 * Maps the outcomes of a source commission onto one outcome of a target commission, so a cohort
 * graded once (against the commission its rubrics were built for) can still be reported against
 * another commission it is also accredited by.
 *
 * `formula` is an arithmetic expression over the *source* commission's `outcome_code`s -- e.g.
 * `([6] + [7]) / 2` -- evaluated by `src/libs/formula.functions.ts`. Both ends are
 * `program_commissions`, which already carry (program, commission, academic period), so a
 * conversion is automatically scoped to a program and a period the way the legacy
 * `ConversionOutcomeComision` was scoped by `idcarrera` + `IdSubModalidadPeriodoAcademico`.
 */
@Entity({ name: 'outcome_conversions', schema: 'accreditation' })
@Unique('UQ_outcome_conversions_source_target_outcome', [
	'sourceProgramCommissionId',
	'targetOutcomeId',
])
@Index('IDX_outcome_conversions_source_program_commission_id', ['sourceProgramCommissionId'])
@Index('IDX_outcome_conversions_target_program_commission_id', ['targetProgramCommissionId'])
export class OutcomeConversionEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	sourceProgramCommissionId: number;

	@IntegerFKIDColumn({ nullable: false })
	targetProgramCommissionId: number;

	@IntegerFKIDColumn({ nullable: false })
	targetOutcomeId: number;

	@TextShortColumn({ nullable: false })
	formula: string;

	@IntegerFKIDColumn({ nullable: true })
	uploadLogId: number;

	// %% RELATIONS

	@ManyToOne(() => ProgramCommissionEntity)
	@JoinColumn({
		name: 'source_program_commission_id',
		foreignKeyConstraintName: 'FK_outcome_conversions_source_program_commission_id',
	})
	sourceProgramCommission: ProgramCommissionEntity;

	@ManyToOne(() => ProgramCommissionEntity)
	@JoinColumn({
		name: 'target_program_commission_id',
		foreignKeyConstraintName: 'FK_outcome_conversions_target_program_commission_id',
	})
	targetProgramCommission: ProgramCommissionEntity;

	@ManyToOne(() => OutcomeEntity)
	@JoinColumn({
		name: 'target_outcome_id',
		foreignKeyConstraintName: 'FK_outcome_conversions_target_outcome_id',
	})
	targetOutcome: OutcomeEntity;
}
