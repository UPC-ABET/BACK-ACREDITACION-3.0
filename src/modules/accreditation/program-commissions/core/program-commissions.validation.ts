import { BadRequestError, ConflictError } from 'src/commons/domain-error';
import { ProgramCommissionRepository } from './program-commissions.repository';
import { OutcomeRepository } from 'src/modules/accreditation/outcomes/core/outcomes.repository';
import { programCommissionsValidationStrings } from '../config/strings/program-commissions.validation';

export class ProgramCommissionValidation {
	static async validateCreate(repo: ProgramCommissionRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				commissionId: data.commissionId,
				programId: data.programId,
				academicPeriodId: data.academicPeriodId,
			},
		});

		if (exists) errors.push(programCommissionsValidationStrings.error.programCommissionExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: programCommissionsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: ProgramCommissionRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(programCommissionsValidationStrings.error.notFound);

		if (data.commissionId && data.programId && data.academicPeriodId) {
			const exists = await repo.findOneByCondition({
				where: {
					commissionId: data.commissionId,
					programId: data.programId,
					academicPeriodId: data.academicPeriodId,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(programCommissionsValidationStrings.error.programCommissionExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: programCommissionsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: ProgramCommissionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: programCommissionsValidationStrings.result.deleteFailed,
			});
		}
	}

	static async validateUnassociate(
		repo: ProgramCommissionRepository,
		outcomeRepo: OutcomeRepository,
		id: number,
	) {
		const errors: Array<string> = [];

		if (!(await repo.findOneById(id))) {
			errors.push(programCommissionsValidationStrings.error.notFound);
		} else {
			const outcome = await outcomeRepo.findOneByCondition({
				where: { programCommissionId: id },
			});
			if (outcome) errors.push(programCommissionsValidationStrings.error.hasOutcomes);
		}

		if (errors.length > 0) {
			throw new ConflictError({
				message: programCommissionsValidationStrings.result.unassociateFailed,
				errors,
			});
		}
	}
}
