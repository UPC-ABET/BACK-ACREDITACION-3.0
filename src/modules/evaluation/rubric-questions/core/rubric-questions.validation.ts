import { HttpException, HttpStatus } from '@nestjs/common';
import { RubricQuestionRepository } from './rubric-questions.repository';
import { rubricQuestionsValidationStrings } from '../config/strings/rubric-questions.validation';
import { IsNull } from 'typeorm';

export class RubricQuestionValidation {
	static async validateCreate(repo: RubricQuestionRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				rubric_id: data.rubric_id,
				outcome_id: data.outcome_id ?? IsNull(),
				question: data.question,
			},
		});

		if (exists) errors.push(rubricQuestionsValidationStrings.error.questionExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: rubricQuestionsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: RubricQuestionRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(rubricQuestionsValidationStrings.error.notFound);

		const rubricId = data.rubric_id ?? entity?.rubric_id;
		const outcomeId = data.outcome_id ?? entity?.outcome_id ?? IsNull();
		const question = data.question ?? entity?.question;

		const exists = await repo.findOneByCondition({
			where: {
				rubric_id: rubricId,
				outcome_id: outcomeId,
				question,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(rubricQuestionsValidationStrings.error.questionExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: rubricQuestionsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: RubricQuestionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: rubricQuestionsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
