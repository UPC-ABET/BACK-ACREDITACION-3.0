import { BadRequestError } from 'src/commons/domain-error';
import { RubricRepository } from './rubrics.repository';
import { rubricsValidationStrings } from '../config/strings/rubrics.validation';

export class RubricValidation {
	static async validateCreate(repo: RubricRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				studyPlanCourseId: data.studyPlanCourseId,
				gradeTypeId: data.gradeTypeId,
				competencyScopeTypeId: data.competencyScopeTypeId,
			},
		});

		if (exists) errors.push(rubricsValidationStrings.error.rubricExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: rubricsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: RubricRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(rubricsValidationStrings.error.notFound);

		if (data.studyPlanCourseId && data.gradeTypeId && data.competencyScopeTypeId) {
			const exists = await repo.findOneByCondition({
				where: {
					studyPlanCourseId: data.studyPlanCourseId,
					gradeTypeId: data.gradeTypeId,
					competencyScopeTypeId: data.competencyScopeTypeId,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(rubricsValidationStrings.error.rubricExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: rubricsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: RubricRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: rubricsValidationStrings.result.deleteFailed,
			});
		}
	}
}
