import { HttpException, HttpStatus } from '@nestjs/common';
import { SurveyRepository } from './surveys.repository';
import { surveysValidationStrings } from '../config/strings/surveys.validation';

export class SurveyValidation {
	static async validateCreate(repo: SurveyRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				survey_type_id: data.survey_type_id,
				student_id: data.student_id,
				academic_period_id: data.academic_period_id,
			},
		});

		if (exists) errors.push(surveysValidationStrings.error.surveyExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: surveysValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: SurveyRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(surveysValidationStrings.error.notFound);

		const surveyTypeId = data.survey_type_id ?? entity?.survey_type_id;
		const studentId = data.student_id ?? entity?.student_id;
		const academicPeriodId = data.academic_period_id ?? entity?.academic_period_id;

		const exists = await repo.findOneByCondition({
			where: {
				survey_type_id: surveyTypeId,
				student_id: studentId,
				academic_period_id: academicPeriodId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(surveysValidationStrings.error.surveyExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: surveysValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: SurveyRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: surveysValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
