import { HttpException, HttpStatus } from '@nestjs/common';
import { ProjectEvaluatorRepository } from './project-evaluators.repository';
import { projectEvaluatorsValidationStrings } from '../config/strings/project-evaluators.validation';

export class ProjectEvaluatorValidation {
	static async validateCreate(repo: ProjectEvaluatorRepository, data: any) {
		const errors: Array<string> = [];

		const duplicateType = await repo.findOneByCondition({
			where: {
				projectId: data.projectId,
				evaluatorTypeId: data.evaluatorTypeId,
			},
		});

		if (duplicateType) errors.push(projectEvaluatorsValidationStrings.error.duplicateEvaluatorType);

		const exists = await repo.findOneByCondition({
			where: {
				projectId: data.projectId,
				professorId: data.professorId,
				evaluatorTypeId: data.evaluatorTypeId,
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

		const projectId = data.projectId ?? entity?.projectId;
		const professorId = data.professorId ?? entity?.professorId;
		const evaluatorTypeId = data.evaluatorTypeId ?? entity?.evaluatorTypeId;

		const exists = await repo.findOneByCondition({
			where: {
				projectId: projectId,
				professorId: professorId,
				evaluatorTypeId: evaluatorTypeId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(projectEvaluatorsValidationStrings.error.projectEvaluatorExists);
		}

		const duplicateType = await repo.findOneByCondition({
			where: {
				projectId: projectId,
				evaluatorTypeId: evaluatorTypeId,
			},
		});

		if (duplicateType && duplicateType.id !== id) {
			errors.push(projectEvaluatorsValidationStrings.error.duplicateEvaluatorType);
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
