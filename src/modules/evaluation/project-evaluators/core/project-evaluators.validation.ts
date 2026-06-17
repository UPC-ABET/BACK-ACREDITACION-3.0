import { HttpException, HttpStatus } from '@nestjs/common';
import { ProjectEvaluatorRepository } from './project-evaluators.repository';
import { projectEvaluatorsValidationStrings } from '../config/strings/project-evaluators.validation';

export class ProjectEvaluatorValidation {
	static async validateCreate(repo: ProjectEvaluatorRepository, data: any) {
		const errors: Array<string> = [];

		const isComite = await repo.isComiteType(data.evaluatorTypeId);

		// Comité allows multiple professors per type; all other types allow only one
		if (!isComite) {
			const duplicateType = await repo.findOneByCondition({
				where: {
					projectId: data.projectId,
					evaluatorTypeId: data.evaluatorTypeId,
					isActive: true,
				},
			});
			if (duplicateType)
				errors.push(projectEvaluatorsValidationStrings.error.duplicateEvaluatorType);
		}

		// Active duplicate check (ignore inactive rows from previous uploads)
		const exists = await repo.findOneByCondition({
			where: {
				projectId: data.projectId,
				professorId: data.professorId,
				evaluatorTypeId: data.evaluatorTypeId,
				isActive: true,
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

		const isComite = await repo.isComiteType(evaluatorTypeId);

		const exists = await repo.findOneByCondition({
			where: {
				projectId,
				professorId,
				evaluatorTypeId,
				isActive: true,
			},
		});
		if (exists && exists.id !== id) {
			errors.push(projectEvaluatorsValidationStrings.error.projectEvaluatorExists);
		}

		if (!isComite) {
			const duplicateType = await repo.findOneByCondition({
				where: {
					projectId,
					evaluatorTypeId,
					isActive: true,
				},
			});
			if (duplicateType && duplicateType.id !== id) {
				errors.push(projectEvaluatorsValidationStrings.error.duplicateEvaluatorType);
			}
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
		const entity = await repo.findOneById(id);
		if (!entity || !entity.isActive) {
			throw new HttpException(
				{ message: projectEvaluatorsValidationStrings.result.deleteFailed },
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
