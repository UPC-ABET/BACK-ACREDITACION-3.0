import { HttpException, HttpStatus } from '@nestjs/common';
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

		if (data.min_score > data.max_score) {
			errors.push(performanceLevelsValidationStrings.error.invalidScoreRange);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: performanceLevelsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
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

		const minScore = data.min_score ?? entity?.min_score;
		const maxScore = data.max_score ?? entity?.max_score;

		if (minScore > maxScore) {
			errors.push(performanceLevelsValidationStrings.error.invalidScoreRange);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: performanceLevelsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: PerformanceLevelRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: performanceLevelsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
