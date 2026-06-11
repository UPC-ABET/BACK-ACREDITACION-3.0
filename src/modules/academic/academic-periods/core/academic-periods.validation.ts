import { HttpException, HttpStatus } from '@nestjs/common';
import { AcademicPeriodRepository } from './academic-periods.repository';
import { academicPeriodsValidationStrings } from '../config/strings/academic-periods.validation';

export class AcademicPeriodValidation {
	static async validateCreate(repo: AcademicPeriodRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: { code: data.code },
		});

		if (exists) errors.push(academicPeriodsValidationStrings.error.codeExists);

		if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
			errors.push(academicPeriodsValidationStrings.error.invalidDateRange);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: academicPeriodsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateOpen(
		repo: AcademicPeriodRepository,
		data: any,
		validModalityTypeIds: Array<number>,
	) {
		if (!validModalityTypeIds.includes(data.modalityTypeId)) {
			throw new HttpException(
				{
					message: academicPeriodsValidationStrings.result.createFailed,
					errors: [academicPeriodsValidationStrings.error.modalityInvalid],
				},
				HttpStatus.BAD_REQUEST,
			);
		}

		await this.validateCreate(repo, data);
	}

	static async validateActivate(repo: AcademicPeriodRepository, id: number) {
		const entity = await repo.findOneById(id);
		if (!entity) {
			throw new HttpException(
				{
					message: academicPeriodsValidationStrings.result.activateFailed,
					errors: [academicPeriodsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}
		return entity;
	}

	static async validateUpdate(repo: AcademicPeriodRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(academicPeriodsValidationStrings.error.notFound);

		if (data.code) {
			const exists = await repo.findOneByCondition({
				where: { code: data.code },
			});

			if (exists && exists.id !== id) {
				errors.push(academicPeriodsValidationStrings.error.codeExists);
			}
		}

		if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
			errors.push(academicPeriodsValidationStrings.error.invalidDateRange);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: academicPeriodsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: AcademicPeriodRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: academicPeriodsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
