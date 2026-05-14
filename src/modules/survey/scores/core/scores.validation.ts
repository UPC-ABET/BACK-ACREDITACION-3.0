import { HttpException, HttpStatus } from '@nestjs/common';
import { ScoreRepository } from './scores.repository';
import { scoresValidationStrings } from '../config/strings/scores.validation';

export class ScoreValidation {
	static async validateCreate(repo: ScoreRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				survey_id: data.survey_id,
				outcome_id: data.outcome_id,
			},
		});

		if (exists) errors.push(scoresValidationStrings.error.scoreExists);

		if (data.score < 0) {
			errors.push(scoresValidationStrings.error.invalidScore);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: scoresValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: ScoreRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(scoresValidationStrings.error.notFound);

		const surveyId = data.survey_id ?? entity?.survey_id;
		const outcomeId = data.outcome_id ?? entity?.outcome_id;

		const exists = await repo.findOneByCondition({
			where: {
				survey_id: surveyId,
				outcome_id: outcomeId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(scoresValidationStrings.error.scoreExists);
		}

		const score = data.score ?? entity?.score;
		if (score < 0) {
			errors.push(scoresValidationStrings.error.invalidScore);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: scoresValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: ScoreRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: scoresValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
