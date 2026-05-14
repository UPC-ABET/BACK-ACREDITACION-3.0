import { HttpException, HttpStatus } from '@nestjs/common';
import { ProjectEvaluatorRepository } from './project-evaluators.repository';
import { projectEvaluatorsValidationStrings } from '../config/strings/project-evaluators.validation';

export class ProjectEvaluatorValidation {
	static async validateCreate(repo: ProjectEvaluatorRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				project_id: data.project_id,
				professor_id: data.professor_id,
				evaluator_type_id: data.evaluator_type_id,
			},
		});

		if (exists) errors.push(projectEvaluatorsValidationStrings.error.projectEvaluatorExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: projectEvaluatorsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: ProjectEvaluatorRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(projectEvaluatorsValidationStrings.error.notFound);

		const projectId = data.project_id ?? entity?.project_id;
		const professorId = data.professor_id ?? entity?.professor_id;
		const evaluatorTypeId = data.evaluator_type_id ?? entity?.evaluator_type_id;

		const exists = await repo.findOneByCondition({
			where: {
				project_id: projectId,
				professor_id: professorId,
				evaluator_type_id: evaluatorTypeId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(projectEvaluatorsValidationStrings.error.projectEvaluatorExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: projectEvaluatorsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: ProjectEvaluatorRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: projectEvaluatorsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
