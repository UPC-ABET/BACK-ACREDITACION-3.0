import { HttpException, HttpStatus } from '@nestjs/common';
import { FindingActionRepository } from './finding-actions.repository';
import { findingActionsValidationStrings } from '../config/strings/finding-actions.validation';

export class FindingActionValidation {
	static async validateCreate(repo: FindingActionRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				finding_id: data.finding_id,
				action_id: data.action_id,
			},
		});

		if (exists) errors.push(findingActionsValidationStrings.error.relationExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: findingActionsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: FindingActionRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(findingActionsValidationStrings.error.notFound);

		const findingId = data.finding_id ?? entity?.finding_id;
		const actionId = data.action_id ?? entity?.action_id;

		const exists = await repo.findOneByCondition({
			where: {
				finding_id: findingId,
				action_id: actionId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(findingActionsValidationStrings.error.relationExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: findingActionsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: FindingActionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: findingActionsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
