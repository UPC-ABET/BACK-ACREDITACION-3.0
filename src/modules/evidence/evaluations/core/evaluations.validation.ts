import { HttpException, HttpStatus } from '@nestjs/common';
import { EvaluationRepository } from './evaluations.repository';
import { evaluationsValidationStrings } from '../config/strings/evaluations.validation';

export class EvaluationValidation {
	static async validateCreate(repo: EvaluationRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				projectStudentId: data.projectStudentId,
				projectEvaluatorId: data.projectEvaluatorId,
			},
		});

		if (exists) errors.push(evaluationsValidationStrings.error.evaluationExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: evaluationsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: EvaluationRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(evaluationsValidationStrings.error.notFound);

		const projectStudentId = data.projectStudentId ?? entity?.projectStudentId;
		const projectEvaluatorId = data.projectEvaluatorId ?? entity?.projectEvaluatorId;

		const exists = await repo.findOneByCondition({
			where: {
				projectStudentId: projectStudentId,
				projectEvaluatorId: projectEvaluatorId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(evaluationsValidationStrings.error.evaluationExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: evaluationsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: EvaluationRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: evaluationsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
