import { BadRequestError } from 'src/commons/domain-error';
import { AccreditorRepository } from './accreditors.repository';
import { accreditorsValidationStrings } from '../config/strings/accreditors.validation';

export class AccreditorValidation {
	static async validateCreate(repo: AccreditorRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: { code: data.code },
		});

		if (exists) errors.push(accreditorsValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: accreditorsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: AccreditorRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(accreditorsValidationStrings.error.notFound);

		if (data.code) {
			const exists = await repo.findOneByCondition({
				where: { code: data.code },
			});

			if (exists && exists.id !== id) {
				errors.push(accreditorsValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: accreditorsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: AccreditorRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: accreditorsValidationStrings.result.deleteFailed,
			});
		}
	}
}
