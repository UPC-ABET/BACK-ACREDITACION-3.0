import { HttpException, HttpStatus } from '@nestjs/common';
import { CommissionRepository } from './commissions.repository';
import { commissionsValidationStrings } from '../config/strings/commissions.validation';

export class CommissionValidation {
	static async validateCreate(repo: CommissionRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				accreditorId: data.accreditorId,
				code: data.code,
			},
		});

		if (exists) errors.push(commissionsValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: commissionsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: CommissionRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(commissionsValidationStrings.error.notFound);

		if (data.accreditorId && data.code) {
			const exists = await repo.findOneByCondition({
				where: {
					accreditorId: data.accreditorId,
					code: data.code,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(commissionsValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: commissionsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: CommissionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: commissionsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
