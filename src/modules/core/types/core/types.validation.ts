import { HttpException, HttpStatus } from '@nestjs/common';
import { TypeRepository } from './types.repository';
import { typesValidationStrings } from '../config/strings/types.validation';

export class TypeValidation {
	static async validateCreate(repo: TypeRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				typeGroupId: data.typeGroupId,
				code: data.code,
			},
		});

		if (exists) errors.push(typesValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: typesValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: TypeRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(typesValidationStrings.error.notFound);

		if (data.typeGroupId && data.code) {
			const exists = await repo.findOneByCondition({
				where: {
					typeGroupId: data.typeGroupId,
					code: data.code,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(typesValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: typesValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: TypeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: typesValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
