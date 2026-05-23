import { HttpException, HttpStatus } from '@nestjs/common';
import { RubricRepository } from './rubrics.repository';
import { rubricsValidationStrings } from '../config/strings/rubrics.validation';

export class RubricValidation {
	static async validateCreate(repo: RubricRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				study_plan_course_id: data.study_plan_course_id,
				grade_type_id: data.grade_type_id,
			},
		});

		if (exists) errors.push(rubricsValidationStrings.error.rubricExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: rubricsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: RubricRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(rubricsValidationStrings.error.notFound);

		if (data.study_plan_course_id && data.grade_type_id) {
			const exists = await repo.findOneByCondition({
				where: {
					study_plan_course_id: data.study_plan_course_id,
					grade_type_id: data.grade_type_id,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(rubricsValidationStrings.error.rubricExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: rubricsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: RubricRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: rubricsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
