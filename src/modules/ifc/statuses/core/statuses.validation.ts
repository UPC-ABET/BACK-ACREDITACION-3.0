import { HttpException, HttpStatus } from '@nestjs/common';
import { StatusRepository } from './statuses.repository';
import { statusesValidationStrings } from '../config/strings/statuses.validation';

export class StatusValidation {
	static async validateCreate(repo: StatusRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				ifc_id: data.ifc_id,
				status_type_id: data.status_type_id,
				register_at: data.register_at,
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

		const ifcId = data.ifc_id ?? entity?.ifc_id;
		const statusTypeId = data.status_type_id ?? entity?.status_type_id;
		const registerAt = data.register_at ?? entity?.register_at;

		const exists = await repo.findOneByCondition({
			where: {
				ifc_id: ifcId,
				status_type_id: statusTypeId,
				register_at: registerAt,
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
