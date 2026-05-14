import { HttpException, HttpStatus } from '@nestjs/common';
import { OutcomeConfigRepository } from './outcome-configs.repository';
import { outcomeConfigsValidationStrings } from '../config/strings/outcome-configs.validation';

export class OutcomeConfigValidation {
	static async validateCreate(repo: OutcomeConfigRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				outcome_id: data.outcome_id,
			},
		});

		if (exists) errors.push(outcomeConfigsValidationStrings.error.configExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: outcomeConfigsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: OutcomeConfigRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(outcomeConfigsValidationStrings.error.notFound);

		const outcomeId = data.outcome_id ?? entity?.outcome_id;

		const exists = await repo.findOneByCondition({
			where: {
				outcome_id: outcomeId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(outcomeConfigsValidationStrings.error.configExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: outcomeConfigsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: OutcomeConfigRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: outcomeConfigsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
