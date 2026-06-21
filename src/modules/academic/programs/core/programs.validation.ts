import { BadRequestError } from 'src/commons/domain-error';
import { ProgramRepository } from './programs.repository';
import { programsValidationStrings } from '../config/strings/programs.validation';

export class ProgramValidation {
	static async validateCreate(repo: ProgramRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: { code: data.code },
		});

		if (exists) errors.push(programsValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: programsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: ProgramRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(programsValidationStrings.error.notFound);

		if (data.code) {
			const exists = await repo.findOneByCondition({
				where: { code: data.code },
			});

			if (exists && exists.id !== id) {
				errors.push(programsValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: programsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: ProgramRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: programsValidationStrings.result.deleteFailed,
			});
		}
	}
}
