import { BadRequestError } from 'src/commons/domain-error';
import { PerformanceLevelRepository } from './performance-levels.repository';
import { performanceLevelsValidationStrings } from '../config/strings/performance-levels.validation';

export class PerformanceLevelValidation {
	static async validateCreate(repo: PerformanceLevelRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				code: data.code,
			},
		});

		if (exists) errors.push(performanceLevelsValidationStrings.error.nameExists);

		if (data.minScore > data.maxScore) {
			errors.push(performanceLevelsValidationStrings.error.invalidScoreRange);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: performanceLevelsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: PerformanceLevelRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(performanceLevelsValidationStrings.error.notFound);

		if (data.code) {
			const exists = await repo.findOneByCondition({
				where: { code: data.code },
			});

			if (exists && exists.id !== id) {
				errors.push(performanceLevelsValidationStrings.error.nameExists);
			}
		}

		const minScore = data.minScore ?? entity?.minScore;
		const maxScore = data.maxScore ?? entity?.maxScore;

		if (minScore > maxScore) {
			errors.push(performanceLevelsValidationStrings.error.invalidScoreRange);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: performanceLevelsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: PerformanceLevelRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: performanceLevelsValidationStrings.result.deleteFailed,
			});
		}
	}
}
