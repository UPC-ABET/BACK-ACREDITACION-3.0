import { BadRequestError } from 'src/commons/domain-error';
import { SurveyRepository } from './surveys.repository';
import { surveysValidationStrings } from '../config/strings/surveys.validation';

export class SurveyValidation {
	static async validateCreate(repo: SurveyRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				surveyTypeId: data.surveyTypeId,
				studentId: data.studentId,
				academicPeriodId: data.academicPeriodId,
			},
		});

		if (exists) errors.push(surveysValidationStrings.error.surveyExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: surveysValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: SurveyRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(surveysValidationStrings.error.notFound);

		const surveyTypeId = data.surveyTypeId ?? entity?.surveyTypeId;
		const studentId = data.studentId ?? entity?.studentId;
		const academicPeriodId = data.academicPeriodId ?? entity?.academicPeriodId;

		const exists = await repo.findOneByCondition({
			where: {
				surveyTypeId: surveyTypeId,
				studentId: studentId,
				academicPeriodId: academicPeriodId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(surveysValidationStrings.error.surveyExists);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: surveysValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: SurveyRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: surveysValidationStrings.result.deleteFailed,
			});
		}
	}
}
