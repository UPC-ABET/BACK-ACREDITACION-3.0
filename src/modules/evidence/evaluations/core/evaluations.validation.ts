import { HttpException, HttpStatus } from '@nestjs/common';
import { EvaluationRepository } from './evaluations.repository';
import { evaluationsValidationStrings } from '../config/strings/evaluations.validation';

export class EvaluationValidation {
	static async validateCreate(repo: EvaluationRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				project_student_id: data.project_student_id,
				project_evaluator_id: data.project_evaluator_id,
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

		const projectStudentId = data.project_student_id ?? entity?.project_student_id;
		const projectEvaluatorId = data.project_evaluator_id ?? entity?.project_evaluator_id;

		const exists = await repo.findOneByCondition({
			where: {
				project_student_id: projectStudentId,
				project_evaluator_id: projectEvaluatorId,
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
