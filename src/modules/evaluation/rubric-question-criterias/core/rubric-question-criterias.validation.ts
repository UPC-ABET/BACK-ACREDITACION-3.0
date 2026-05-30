import { HttpException, HttpStatus } from '@nestjs/common';
import { RubricQuestionCriteriaRepository } from './rubric-question-criterias.repository';
import { rubricQuestionCriteriasValidationStrings } from '../config/strings/rubric-question-criterias.validation';

export class RubricQuestionCriteriaValidation {
	static async validateCreate(repo: RubricQuestionCriteriaRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				rubricQuestionId: data.rubricQuestionId,
				criteria: data.criteria,
			},
		});

		if (exists) errors.push(rubricQuestionCriteriasValidationStrings.error.criteriaExists);

		if (data.minValue > data.maxValue) {
			errors.push(rubricQuestionCriteriasValidationStrings.error.invalidRange);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: rubricQuestionCriteriasValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: RubricQuestionCriteriaRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(rubricQuestionCriteriasValidationStrings.error.notFound);

		if (data.rubricQuestionId && data.criteria) {
			const exists = await repo.findOneByCondition({
				where: {
					rubricQuestionId: data.rubricQuestionId,
					criteria: data.criteria,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(rubricQuestionCriteriasValidationStrings.error.criteriaExists);
			}
		}

		const minValue = data.minValue ?? entity?.minValue;
		const maxValue = data.maxValue ?? entity?.maxValue;

		if (minValue > maxValue) {
			errors.push(rubricQuestionCriteriasValidationStrings.error.invalidRange);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: rubricQuestionCriteriasValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: RubricQuestionCriteriaRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: rubricQuestionCriteriasValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
