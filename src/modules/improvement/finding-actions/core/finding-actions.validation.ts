import { BadRequestError } from 'src/commons/domain-error';
import { FindingActionRepository } from './finding-actions.repository';
import { findingActionsValidationStrings } from '../config/strings/finding-actions.validation';

export class FindingActionValidation {
	static async validateCreate(repo: FindingActionRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				findingId: data.findingId,
				actionId: data.actionId,
			},
		});

		if (exists) errors.push(findingActionsValidationStrings.error.relationExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: findingActionsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: FindingActionRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(findingActionsValidationStrings.error.notFound);

		const findingId = data.findingId ?? entity?.findingId;
		const actionId = data.actionId ?? entity?.actionId;

		const exists = await repo.findOneByCondition({
			where: {
				findingId: findingId,
				actionId: actionId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(findingActionsValidationStrings.error.relationExists);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: findingActionsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: FindingActionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: findingActionsValidationStrings.result.deleteFailed,
			});
		}
	}
}
