import { BadRequestError } from 'src/commons/domain-error';
import { PlanActionRepository } from './plan-actions.repository';
import { planActionsValidationStrings } from '../config/strings/plan-actions.validation';

export class PlanActionValidation {
	static async validateCreate(repo: PlanActionRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				planId: data.planId,
				findingActionId: data.findingActionId,
			},
		});

		if (exists) errors.push(planActionsValidationStrings.error.relationExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: planActionsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: PlanActionRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(planActionsValidationStrings.error.notFound);

		const planId = data.planId ?? entity?.planId;
		const findingActionId = data.findingActionId ?? entity?.findingActionId;

		const exists = await repo.findOneByCondition({
			where: {
				planId: planId,
				findingActionId: findingActionId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(planActionsValidationStrings.error.relationExists);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: planActionsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: PlanActionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: planActionsValidationStrings.result.deleteFailed,
			});
		}
	}
}
