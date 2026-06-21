import { BadRequestError } from 'src/commons/domain-error';
import { ActionRepository } from './actions.repository';
import { actionsValidationStrings } from '../config/strings/actions.validation';

export class ActionValidation {
	static async validateCreate(repo: ActionRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: { description: data.description },
		});

		if (exists) errors.push(actionsValidationStrings.error.actionExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: actionsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: ActionRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(actionsValidationStrings.error.notFound);

		if (data.description) {
			const exists = await repo.findOneByCondition({
				where: { description: data.description },
			});

			if (exists && exists.id !== id) {
				errors.push(actionsValidationStrings.error.actionExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: actionsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: ActionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: actionsValidationStrings.result.deleteFailed,
			});
		}
	}
}
