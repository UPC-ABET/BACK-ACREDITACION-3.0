import { BadRequestError } from 'src/commons/domain-error';
import { PlanRepository } from './plans.repository';
import { plansValidationStrings } from '../config/strings/plans.validation';

export class PlanValidation {
	static async validateCreate(repo: PlanRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				programId: data.programId,
				academicPeriodId: data.academicPeriodId,
				name: data.name,
			},
		});

		if (exists) errors.push(plansValidationStrings.error.planExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: plansValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: PlanRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(plansValidationStrings.error.notFound);

		const programId = data.programId ?? entity?.programId;
		const academicPeriodId = data.academicPeriodId ?? entity?.academicPeriodId;
		const name = data.name ?? entity?.name;

		const exists = await repo.findOneByCondition({
			where: {
				programId: programId,
				academicPeriodId: academicPeriodId,
				name,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(plansValidationStrings.error.planExists);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: plansValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: PlanRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: plansValidationStrings.result.deleteFailed,
			});
		}
	}
}
