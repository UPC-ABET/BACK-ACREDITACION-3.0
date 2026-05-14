import { HttpException, HttpStatus } from '@nestjs/common';
import { FindingOutcomeRepository } from './finding-outcomes.repository';
import { findingOutcomesValidationStrings } from '../config/strings/finding-outcomes.validation';

export class FindingOutcomeValidation {
	static async validateCreate(repo: FindingOutcomeRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				finding_id: data.finding_id,
				outcome_id: data.outcome_id,
			},
		});

		if (exists) errors.push(findingOutcomesValidationStrings.error.relationExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: findingOutcomesValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: FindingOutcomeRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(findingOutcomesValidationStrings.error.notFound);

		const findingId = data.finding_id ?? entity?.finding_id;
		const outcomeId = data.outcome_id ?? entity?.outcome_id;

		const exists = await repo.findOneByCondition({
			where: {
				finding_id: findingId,
				outcome_id: outcomeId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(findingOutcomesValidationStrings.error.relationExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: findingOutcomesValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: FindingOutcomeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: findingOutcomesValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
