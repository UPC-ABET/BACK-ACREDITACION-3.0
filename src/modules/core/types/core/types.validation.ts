import { BadRequestError, NotFoundError } from 'src/commons/domain-error';
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
			throw new BadRequestError({
				message: typesValidationStrings.result.createFailed,
				errors,
			});
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
			throw new BadRequestError({
				message: typesValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateExists(repo: TypeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new NotFoundError({ message: typesValidationStrings.error.notFound });
		}
	}

	static async validateDelete(repo: TypeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: typesValidationStrings.result.deleteFailed,
			});
		}
	}
}
