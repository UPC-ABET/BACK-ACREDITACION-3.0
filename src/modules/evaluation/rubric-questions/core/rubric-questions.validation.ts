import { BadRequestError } from 'src/commons/domain-error';
import { RubricQuestionRepository } from './rubric-questions.repository';
import { rubricQuestionsValidationStrings } from '../config/strings/rubric-questions.validation';
import { IsNull } from 'typeorm';

export class RubricQuestionValidation {
	static async validateCreate(repo: RubricQuestionRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				rubricId: data.rubricId,
				outcomeId: data.outcomeId ?? IsNull(),
				question: data.question,
			},
		});

		if (exists) errors.push(rubricQuestionsValidationStrings.error.questionExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: rubricQuestionsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: RubricQuestionRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(rubricQuestionsValidationStrings.error.notFound);

		const rubricId = data.rubricId ?? entity?.rubricId;
		const outcomeId = data.outcomeId ?? entity?.outcomeId ?? IsNull();
		const question = data.question ?? entity?.question;

		const exists = await repo.findOneByCondition({
			where: {
				rubricId: rubricId,
				outcomeId: outcomeId,
				question,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(rubricQuestionsValidationStrings.error.questionExists);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: rubricQuestionsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: RubricQuestionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: rubricQuestionsValidationStrings.result.deleteFailed,
			});
		}
	}
}
