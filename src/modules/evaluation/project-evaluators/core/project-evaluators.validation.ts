import { BadRequestError } from 'src/commons/domain-error';
import { ProjectEvaluatorRepository } from './project-evaluators.repository';
import { projectEvaluatorsValidationStrings } from '../config/strings/project-evaluators.validation';

export class ProjectEvaluatorValidation {
	static async validateCreate(repo: ProjectEvaluatorRepository, data: any) {
		const errors: Array<string> = [];

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

		const maxEvaluators = await repo.getMaxEvaluators(data.evaluatorTypeId);
		if (maxEvaluators !== null) {
			const current = await repo.countActiveByType(data.projectId, data.evaluatorTypeId);
			if (current >= maxEvaluators)
				errors.push(projectEvaluatorsValidationStrings.error.duplicateEvaluatorType);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: projectEvaluatorsValidationStrings.result.createFailed,
				errors,
			});
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
				projectId,
				professorId,
				evaluatorTypeId,
				isActive: true,
			},
		});
		if (exists && exists.id !== id) {
			errors.push(projectEvaluatorsValidationStrings.error.projectEvaluatorExists);
		}

		const maxEvaluators = await repo.getMaxEvaluators(evaluatorTypeId);
		if (maxEvaluators !== null) {
			const current = await repo.countActiveByType(projectId, evaluatorTypeId);
			if (current > maxEvaluators) {
				errors.push(projectEvaluatorsValidationStrings.error.duplicateEvaluatorType);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: projectEvaluatorsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: ProjectEvaluatorRepository, id: number) {
		const entity = await repo.findOneById(id);
		if (!entity || !entity.isActive) {
			throw new BadRequestError({
				message: projectEvaluatorsValidationStrings.result.deleteFailed,
			});
		}
	}
}
