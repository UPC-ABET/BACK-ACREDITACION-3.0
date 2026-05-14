import { HttpException, HttpStatus } from '@nestjs/common';
import { PlanActionRepository } from './plan-actions.repository';
import { planActionsValidationStrings } from '../config/strings/plan-actions.validation';

export class PlanActionValidation {
	static async validateCreate(repo: PlanActionRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				plan_id: data.plan_id,
				finding_action_id: data.finding_action_id,
			},
		});

		if (exists) errors.push(planActionsValidationStrings.error.relationExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: planActionsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: PlanActionRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(planActionsValidationStrings.error.notFound);

		const planId = data.plan_id ?? entity?.plan_id;
		const findingActionId = data.finding_action_id ?? entity?.finding_action_id;

		const exists = await repo.findOneByCondition({
			where: {
				plan_id: planId,
				finding_action_id: findingActionId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(planActionsValidationStrings.error.relationExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: planActionsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: PlanActionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: planActionsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
