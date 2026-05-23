import { HttpException, HttpStatus } from '@nestjs/common';
import { RubricScoreRepository } from './rubric-scores.repository';
import { rubricScoresValidationStrings } from '../config/strings/rubric-scores.validation';

export class RubricScoreValidation {
	static async validateCreate(repo: RubricScoreRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				evaluation_id: data.evaluation_id,
				rubric_question_criteria_id: data.rubric_question_criteria_id,
			},
		});

		if (exists) errors.push(rubricScoresValidationStrings.error.scoreExists);

		if (data.score < 0) {
			errors.push(rubricScoresValidationStrings.error.invalidScore);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: rubricScoresValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: RubricScoreRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(rubricScoresValidationStrings.error.notFound);

		const evaluationId = data.evaluation_id ?? entity?.evaluation_id;
		const rubricQuestionCriteriaId = data.rubric_question_criteria_id ?? entity?.rubric_question_criteria_id;

		const exists = await repo.findOneByCondition({
			where: {
				evaluation_id: evaluationId,
				rubric_question_criteria_id: rubricQuestionCriteriaId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(rubricScoresValidationStrings.error.scoreExists);
		}

		const score = data.score ?? entity?.score;
		if (score < 0) {
			errors.push(rubricScoresValidationStrings.error.invalidScore);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: rubricScoresValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: RubricScoreRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: rubricScoresValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
