import { BadRequestError } from 'src/commons/domain-error';
import { ProjectGroupRepository } from './project-groups.repository';
import { projectGroupsValidationStrings } from '../config/strings/project-groups.validation';
import { CreateProjectGroupDto, UpdateProjectGroupDto } from '../model/project-groups.dtos';

type CreateProjectGroupData = CreateProjectGroupDto & { academicPeriodId: number };
type UpdateProjectGroupData = UpdateProjectGroupDto & { academicPeriodId?: number };

export class ProjectGroupValidation {
	static async validateCreate(repo: ProjectGroupRepository, data: CreateProjectGroupData) {
		const errors: Array<string> = [];

		if (!(await repo.academicPeriodExists(data.academicPeriodId))) {
			errors.push(projectGroupsValidationStrings.error.academicPeriodNotFound);
		}
		if (!(await repo.programExists(data.programId))) {
			errors.push(projectGroupsValidationStrings.error.programNotFound);
		}

		const exists = await repo.findByCodeInScope(data.code, data.academicPeriodId, data.programId);
		if (exists) errors.push(projectGroupsValidationStrings.error.codeExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: projectGroupsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(
		repo: ProjectGroupRepository,
		id: number,
		data: UpdateProjectGroupData,
	) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) {
			throw new BadRequestError({
				message: projectGroupsValidationStrings.result.updateFailed,
				errors: [projectGroupsValidationStrings.error.notFound],
			});
		}

		const academicPeriodId = data.academicPeriodId ?? entity.academicPeriodId;
		const programId = data.programId ?? entity.programId;
		const code = data.code ?? entity.code;

		if (data.academicPeriodId && !(await repo.academicPeriodExists(data.academicPeriodId))) {
			errors.push(projectGroupsValidationStrings.error.academicPeriodNotFound);
		}
		if (data.programId && !(await repo.programExists(data.programId))) {
			errors.push(projectGroupsValidationStrings.error.programNotFound);
		}

		// re-check business-key uniqueness only when any part of it changes
		if (data.code || data.academicPeriodId || data.programId) {
			const exists = await repo.findByCodeInScope(code, academicPeriodId, programId);
			if (exists && exists.id !== id) {
				errors.push(projectGroupsValidationStrings.error.codeExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: projectGroupsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: ProjectGroupRepository, id: number) {
		const entity = await repo.findOneById(id);
		if (!entity) {
			throw new BadRequestError({
				message: projectGroupsValidationStrings.result.deleteFailed,
				errors: [projectGroupsValidationStrings.error.notFound],
			});
		}

		if (await repo.hasProjects(id)) {
			throw new BadRequestError({
				message: projectGroupsValidationStrings.result.deleteFailed,
				errors: [projectGroupsValidationStrings.error.hasProjects],
			});
		}
	}
}
