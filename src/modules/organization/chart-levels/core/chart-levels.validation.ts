import { HttpException, HttpStatus } from '@nestjs/common';
import { ChartLevelRepository } from './chart-levels.repository';
import { chartLevelsValidationStrings } from '../config/strings/chart-levels.validation';

export class ChartLevelValidation {
	static async validateCreate(repo: ChartLevelRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				level: data.level,
				level_type_id: data.level_type_id,
			},
		});

		if (exists) errors.push(chartLevelsValidationStrings.error.levelExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: chartLevelsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: ChartLevelRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(chartLevelsValidationStrings.error.notFound);

		if (data.level && data.level_type_id) {
			const exists = await repo.findOneByCondition({
				where: {
					level: data.level,
					level_type_id: data.level_type_id,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(chartLevelsValidationStrings.error.levelExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: chartLevelsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: ChartLevelRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: chartLevelsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
