import { HttpException, HttpStatus } from '@nestjs/common';
import { OutcomeRepository } from './outcomes.repository';
import { outcomesValidationStrings } from '../config/strings/outcomes.validation';

export class OutcomeValidation {
	static async validateCreate(repo: OutcomeRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				programCommissionId: data.programCommissionId,
				outcomeCode: data.outcomeCode,
			},
		});

		if (exists) errors.push(outcomesValidationStrings.error.outcomeCodeExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: outcomesValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: OutcomeRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(outcomesValidationStrings.error.notFound);

		if (data.programCommissionId && data.outcomeCode) {
			const exists = await repo.findOneByCondition({
				where: {
					programCommissionId: data.programCommissionId,
					outcomeCode: data.outcomeCode,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(outcomesValidationStrings.error.outcomeCodeExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: outcomesValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: OutcomeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: outcomesValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
