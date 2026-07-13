import { BadRequestError, NotFoundError } from 'src/commons/domain-error';
import { assertValidFormula, extractFormulaReferences } from 'src/libs/formula.functions';
import { OutcomeRepository } from 'src/modules/accreditation/outcomes/core/outcomes.repository';
import { ProgramCommissionRepository } from 'src/modules/accreditation/program-commissions/core/program-commissions.repository';
import { OutcomeConversionEntity } from '../model/outcome-conversions.entity';
import { OutcomeConversionsRepository } from './outcome-conversions.repository';
import { outcomeConversionsValidationStrings as strings } from '../config/strings/outcome-conversions.validation';

export interface OutcomeConversionInput {
	sourceProgramCommissionId: number;
	targetProgramCommissionId: number;
	targetOutcomeId: number;
	formula: string;
}

export class OutcomeConversionValidation {
	/**
	 * A conversion only makes sense between two commissions accrediting the same program in the same
	 * academic period: that pairing is what the legacy model expressed as
	 * (idcarrera, IdSubModalidadPeriodoAcademico). The formula is then checked against the *source*
	 * commission's outcome codes, so a typo cannot silently produce an unconvertible rule that only
	 * fails later, mid-grading.
	 */
	static async validateUpsert(
		conversionRepo: OutcomeConversionsRepository,
		programCommissionRepo: ProgramCommissionRepository,
		outcomeRepo: OutcomeRepository,
		data: OutcomeConversionInput,
		currentId?: number,
	): Promise<void> {
		const errors: string[] = [];

		if (data.sourceProgramCommissionId === data.targetProgramCommissionId) {
			errors.push(strings.error.sameSourceAndTarget);
			throw new BadRequestError({ message: strings.result.createFailed, errors });
		}

		const source = await programCommissionRepo.findOneById(data.sourceProgramCommissionId);
		if (!source) {
			throw new NotFoundError(strings.error.sourceProgramCommissionNotFound);
		}

		const target = await programCommissionRepo.findOneById(data.targetProgramCommissionId);
		if (!target) {
			throw new NotFoundError(strings.error.targetProgramCommissionNotFound);
		}

		if (
			source.programId !== target.programId ||
			source.academicPeriodId !== target.academicPeriodId
		) {
			errors.push(strings.error.commissionPeriodMismatch);
		}

		const targetOutcome = await outcomeRepo.findOneById(data.targetOutcomeId);
		if (!targetOutcome) {
			throw new NotFoundError(strings.error.targetOutcomeNotFound);
		}
		if (targetOutcome.programCommissionId !== data.targetProgramCommissionId) {
			errors.push(strings.error.targetOutcomeNotInTargetCommission);
		}

		let references: string[] = [];
		try {
			assertValidFormula(data.formula);
			references = extractFormulaReferences(data.formula);
		} catch {
			errors.push(strings.error.invalidFormula);
		}

		if (references.length > 0) {
			const sourceOutcomes = await outcomeRepo.findByCondition({
				where: { programCommissionId: data.sourceProgramCommissionId, isActive: true },
			});
			const sourceCodes = new Set(sourceOutcomes.map((outcome) => outcome.outcomeCode));
			if (references.some((reference) => !sourceCodes.has(reference))) {
				errors.push(strings.error.unknownOutcomeReference);
			}
		}

		const duplicate = (await conversionRepo.findOneByCondition({
			where: {
				sourceProgramCommissionId: data.sourceProgramCommissionId,
				targetOutcomeId: data.targetOutcomeId,
			},
		})) as OutcomeConversionEntity | null;
		if (duplicate && duplicate.id !== currentId) {
			errors.push(strings.error.duplicateConversion);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: currentId ? strings.result.updateFailed : strings.result.createFailed,
				errors,
			});
		}
	}
}
