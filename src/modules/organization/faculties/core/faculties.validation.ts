import { BadRequestError } from 'src/commons/domain-error';
import { FacultyRepository } from './faculties.repository';
import { facultiesValidationStrings } from '../config/strings/faculties.validation';

export class FacultyValidation {
	static async validateCreate(repo: FacultyRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: { code: data.code },
		});

		if (exists) errors.push(facultiesValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: facultiesValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: FacultyRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(facultiesValidationStrings.error.notFound);

		if (data.code) {
			const exists = await repo.findOneByCondition({
				where: { code: data.code },
			});

			if (exists && exists.id !== id) {
				errors.push(facultiesValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: facultiesValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: FacultyRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: facultiesValidationStrings.result.deleteFailed,
			});
		}
	}
}
