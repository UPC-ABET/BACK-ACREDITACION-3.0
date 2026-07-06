import { BadRequestError } from 'src/commons/domain-error';
import { EvaluationRepository } from './evaluations.repository';
import { evaluationsValidationStrings } from '../config/strings/evaluations.validation';

export class EvaluationValidation {
	static async validateCreate(repo: EvaluationRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				projectStudentId: data.projectStudentId,
				rubricId: data.rubricId,
			},
		});

		if (exists) errors.push(evaluationsValidationStrings.error.evaluationExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: evaluationsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: EvaluationRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(evaluationsValidationStrings.error.notFound);

		const projectStudentId = data.projectStudentId ?? entity?.projectStudentId;
		const rubricId = data.rubricId ?? entity?.rubricId;

		const exists = await repo.findOneByCondition({
			where: {
				projectStudentId: projectStudentId,
				rubricId: rubricId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(evaluationsValidationStrings.error.evaluationExists);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: evaluationsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: EvaluationRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: evaluationsValidationStrings.result.deleteFailed,
			});
		}
	}
}
