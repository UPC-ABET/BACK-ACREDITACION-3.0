import { BadRequestError } from 'src/commons/domain-error';
import { ProjectRepository } from './projects.repository';
import { projectsValidationStrings } from '../config/strings/projects.validation';

export class ProjectValidation {
	static async validateCreate(repo: ProjectRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: { code: data.code },
		});

		if (exists) errors.push(projectsValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: projectsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: ProjectRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(projectsValidationStrings.error.notFound);

		if (data.code) {
			const exists = await repo.findOneByCondition({
				where: { code: data.code },
			});

			if (exists && exists.id !== id) {
				errors.push(projectsValidationStrings.error.codeExists);
			}
		}

		if (data.projectGroupId) {
			const group = await repo.getProjectGroupById(data.projectGroupId);
			if (!group) {
				errors.push(projectsValidationStrings.error.projectGroupNotFound);
			} else if (entity?.projectGroupId) {
				const currentGroup = await repo.getProjectGroupById(entity.projectGroupId);
				if (currentGroup && currentGroup.academicPeriodId !== group.academicPeriodId) {
					errors.push(projectsValidationStrings.error.projectGroupPeriodMismatch);
				}
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: projectsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: ProjectRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: projectsValidationStrings.result.deleteFailed,
			});
		}

		const hasScores = await repo.hasRubricScores(id);
		if (hasScores) {
			throw new BadRequestError({
				message: projectsValidationStrings.result.deleteFailed,
				errors: [projectsValidationStrings.error.hasEvaluations],
			});
		}
	}
}
