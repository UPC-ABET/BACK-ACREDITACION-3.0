import { BadRequestError } from 'src/commons/domain-error';
import { RubricScoreRepository } from './rubric-scores.repository';
import { rubricScoresValidationStrings } from '../config/strings/rubric-scores.validation';

export class RubricScoreValidation {
	static async validateCreate(repo: RubricScoreRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				evaluationId: data.evaluationId,
				rubricQuestionCriteriaId: data.rubricQuestionCriteriaId,
			},
		});

		if (exists) errors.push(rubricScoresValidationStrings.error.scoreExists);

		if (data.score < 0) {
			errors.push(rubricScoresValidationStrings.error.invalidScore);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: rubricScoresValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: RubricScoreRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(rubricScoresValidationStrings.error.notFound);

		const evaluationId = data.evaluationId ?? entity?.evaluationId;
		const rubricQuestionCriteriaId =
			data.rubricQuestionCriteriaId ?? entity?.rubricQuestionCriteriaId;

		const exists = await repo.findOneByCondition({
			where: {
				evaluationId: evaluationId,
				rubricQuestionCriteriaId: rubricQuestionCriteriaId,
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
			throw new BadRequestError({
				message: rubricScoresValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: RubricScoreRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: rubricScoresValidationStrings.result.deleteFailed,
			});
		}
	}
}
