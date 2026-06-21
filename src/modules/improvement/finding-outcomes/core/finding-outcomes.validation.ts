import { BadRequestError } from 'src/commons/domain-error';
import { FindingOutcomeRepository } from './finding-outcomes.repository';
import { findingOutcomesValidationStrings } from '../config/strings/finding-outcomes.validation';

export class FindingOutcomeValidation {
	static async validateCreate(repo: FindingOutcomeRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				findingId: data.findingId,
				outcomeId: data.outcomeId,
			},
		});

		if (exists) errors.push(findingOutcomesValidationStrings.error.relationExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: findingOutcomesValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: FindingOutcomeRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(findingOutcomesValidationStrings.error.notFound);

		const findingId = data.findingId ?? entity?.findingId;
		const outcomeId = data.outcomeId ?? entity?.outcomeId;

		const exists = await repo.findOneByCondition({
			where: {
				findingId: findingId,
				outcomeId: outcomeId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(findingOutcomesValidationStrings.error.relationExists);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: findingOutcomesValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: FindingOutcomeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: findingOutcomesValidationStrings.result.deleteFailed,
			});
		}
	}
}
