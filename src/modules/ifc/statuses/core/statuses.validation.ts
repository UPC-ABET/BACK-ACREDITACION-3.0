import { HttpException, HttpStatus } from '@nestjs/common';
import { StatusRepository } from './statuses.repository';
import { statusesValidationStrings } from '../config/strings/statuses.validation';

export class StatusValidation {
	static async validateCreate(repo: StatusRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				ifcId: data.ifcId,
				statusTypeId: data.statusTypeId,
				registerAt: data.registerAt,
			},
		});

		if (exists) errors.push(statusesValidationStrings.error.statusExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: statusesValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: StatusRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(statusesValidationStrings.error.notFound);

		const ifcId = data.ifcId ?? entity?.ifcId;
		const statusTypeId = data.statusTypeId ?? entity?.statusTypeId;
		const registerAt = data.registerAt ?? entity?.registerAt;

		const exists = await repo.findOneByCondition({
			where: {
				ifcId: ifcId,
				statusTypeId: statusTypeId,
				registerAt: registerAt,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(statusesValidationStrings.error.statusExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: statusesValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: StatusRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: statusesValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
