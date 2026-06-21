import { BadRequestError } from 'src/commons/domain-error';
import { InstrumentRepository } from './instruments.repository';
import { instrumentsValidationStrings } from '../config/strings/instruments.validation';

export class InstrumentValidation {
	static async validateCreate(repo: InstrumentRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: { code: data.code },
		});

		if (exists) errors.push(instrumentsValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: instrumentsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: InstrumentRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(instrumentsValidationStrings.error.notFound);

		if (data.code) {
			const exists = await repo.findOneByCondition({
				where: { code: data.code },
			});

			if (exists && exists.id !== id) {
				errors.push(instrumentsValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: instrumentsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: InstrumentRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: instrumentsValidationStrings.result.deleteFailed,
			});
		}
	}
}
