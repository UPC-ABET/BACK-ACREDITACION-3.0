import { BadRequestError } from 'src/commons/domain-error';
import { StudyPlanAcademicPeriodRepository } from './study-plan-academic-periods.repository';
import { studyPlanAcademicPeriodsValidationStrings } from '../config/strings/study-plan-academic-periods.validation';

export class StudyPlanAcademicPeriodValidation {
	static async validateCreate(repo: StudyPlanAcademicPeriodRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				studyPlanId: data.studyPlanId,
				academicPeriodId: data.academicPeriodId,
			},
		});

		if (exists)
			errors.push(studyPlanAcademicPeriodsValidationStrings.error.studyPlanAcademicPeriodExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: studyPlanAcademicPeriodsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: StudyPlanAcademicPeriodRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(studyPlanAcademicPeriodsValidationStrings.error.notFound);

		if (data.studyPlanId && data.academicPeriodId) {
			const exists = await repo.findOneByCondition({
				where: {
					studyPlanId: data.studyPlanId,
					academicPeriodId: data.academicPeriodId,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(studyPlanAcademicPeriodsValidationStrings.error.studyPlanAcademicPeriodExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: studyPlanAcademicPeriodsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: StudyPlanAcademicPeriodRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: studyPlanAcademicPeriodsValidationStrings.result.deleteFailed,
			});
		}
	}
}
