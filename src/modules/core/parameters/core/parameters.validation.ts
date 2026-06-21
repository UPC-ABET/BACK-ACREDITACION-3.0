import { BadRequestError } from 'src/commons/domain-error';
import { ParameterRepository } from './parameters.repository';
import { parametersValidationStrings } from '../config/strings/parameters.validation';

export class ParameterValidation {
	static async validateCreate(repo: ParameterRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: { code: data.code },
		});

		if (exists) errors.push(parametersValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: parametersValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: ParameterRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(parametersValidationStrings.error.notFound);

		if (data.code) {
			const exists = await repo.findOneByCondition({
				where: { code: data.code },
			});

			if (exists && exists.id !== id) {
				errors.push(parametersValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: parametersValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: ParameterRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: parametersValidationStrings.result.deleteFailed,
			});
		}
	}
}
