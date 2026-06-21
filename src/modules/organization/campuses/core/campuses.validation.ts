import { BadRequestError } from 'src/commons/domain-error';
import { CampusRepository } from './campuses.repository';
import { campusesValidationStrings } from '../config/strings/campuses.validation';

export class CampusValidation {
	static async validateCreate(repo: CampusRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: { code: data.code },
		});

		if (exists) errors.push(campusesValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: campusesValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: CampusRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(campusesValidationStrings.error.notFound);

		if (data.code) {
			const exists = await repo.findOneByCondition({
				where: { code: data.code },
			});

			if (exists && exists.id !== id) {
				errors.push(campusesValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: campusesValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: CampusRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: campusesValidationStrings.result.deleteFailed,
			});
		}
	}
}
