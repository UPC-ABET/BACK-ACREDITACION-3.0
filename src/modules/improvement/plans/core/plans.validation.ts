import { HttpException, HttpStatus } from '@nestjs/common';
import { PlanRepository } from './plans.repository';
import { plansValidationStrings } from '../config/strings/plans.validation';

export class PlanValidation {
	static async validateCreate(repo: PlanRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				program_id: data.program_id,
				academic_period_id: data.academic_period_id,
				name: data.name,
			},
		});

		if (exists) errors.push(plansValidationStrings.error.planExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: plansValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: PlanRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(plansValidationStrings.error.notFound);

		const programId = data.program_id ?? entity?.program_id;
		const academicPeriodId = data.academic_period_id ?? entity?.academic_period_id;
		const name = data.name ?? entity?.name;

		const exists = await repo.findOneByCondition({
			where: {
				program_id: programId,
				academic_period_id: academicPeriodId,
				name,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(plansValidationStrings.error.planExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: plansValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: PlanRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: plansValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
