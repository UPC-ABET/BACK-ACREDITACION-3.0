import { BadRequestError } from 'src/commons/domain-error';
import { OutcomeConfigRepository } from './outcome-configs.repository';
import { outcomeConfigsValidationStrings } from '../config/strings/outcome-configs.validation';

export class OutcomeConfigValidation {
	static async validateCreate(repo: OutcomeConfigRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				outcomeId: data.outcomeId,
			},
		});

		if (exists) errors.push(outcomeConfigsValidationStrings.error.configExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: outcomeConfigsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: OutcomeConfigRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(outcomeConfigsValidationStrings.error.notFound);

		const outcomeId = data.outcomeId ?? entity?.outcomeId;

		const exists = await repo.findOneByCondition({
			where: {
				outcomeId: outcomeId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(outcomeConfigsValidationStrings.error.configExists);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: outcomeConfigsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: OutcomeConfigRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: outcomeConfigsValidationStrings.result.deleteFailed,
			});
		}
	}
}
