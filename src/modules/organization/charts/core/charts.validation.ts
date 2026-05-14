import { HttpException, HttpStatus } from '@nestjs/common';
import { ChartRepository } from './charts.repository';
import { chartsValidationStrings } from '../config/strings/charts.validation';

export class ChartValidation {
	static async validateCreate(repo: ChartRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				staff_id: data.staff_id,
				academic_period_id: data.academic_period_id,
				chart_level_id: data.chart_level_id,
			},
		});

		if (exists) errors.push(chartsValidationStrings.error.chartExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: chartsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: ChartRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(chartsValidationStrings.error.notFound);

		if (data.staff_id && data.academic_period_id && data.chart_level_id) {
			const exists = await repo.findOneByCondition({
				where: {
					staff_id: data.staff_id,
					academic_period_id: data.academic_period_id,
					chart_level_id: data.chart_level_id,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(chartsValidationStrings.error.chartExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: chartsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: ChartRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: chartsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
