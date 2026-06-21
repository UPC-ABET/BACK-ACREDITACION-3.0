import { BadRequestError } from 'src/commons/domain-error';
import { TypeGroupRepository } from './type-groups.repository';
import { typeGroupsValidationStrings } from '../config/strings/type-groups.validation';

export class TypeGroupValidation {
	static async validateCreate(repo: TypeGroupRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: { code: data.code },
		});

		if (exists) errors.push(typeGroupsValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: typeGroupsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: TypeGroupRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(typeGroupsValidationStrings.error.notFound);

		if (data.code) {
			const exists = await repo.findOneByCondition({
				where: { code: data.code },
			});

			if (exists && exists.id !== id) {
				errors.push(typeGroupsValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: typeGroupsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: TypeGroupRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: typeGroupsValidationStrings.result.deleteFailed,
			});
		}
	}
}
