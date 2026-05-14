import { HttpException, HttpStatus } from '@nestjs/common';
import { RubricOutcomeCriteriaRepository } from './rubric-outcome-criterias.repository';
import { rubricOutcomeCriteriasValidationStrings } from '../config/strings/rubric-outcome-criterias.validation';

export class RubricOutcomeCriteriaValidation {
	static async validateCreate(repo: RubricOutcomeCriteriaRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				rubric_id: data.rubric_id,
				outcome_id: data.outcome_id,
				criteria: data.criteria,
			},
		});

		if (exists) errors.push(rubricOutcomeCriteriasValidationStrings.error.criteriaExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: rubricOutcomeCriteriasValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: RubricOutcomeCriteriaRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(rubricOutcomeCriteriasValidationStrings.error.notFound);

		const rubricId = data.rubric_id ?? entity?.rubric_id;
		const outcomeId = data.outcome_id ?? entity?.outcome_id;
		const criteria = data.criteria ?? entity?.criteria;

		const exists = await repo.findOneByCondition({
			where: {
				rubric_id: rubricId,
				outcome_id: outcomeId,
				criteria,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(rubricOutcomeCriteriasValidationStrings.error.criteriaExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: rubricOutcomeCriteriasValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: RubricOutcomeCriteriaRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: rubricOutcomeCriteriasValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
