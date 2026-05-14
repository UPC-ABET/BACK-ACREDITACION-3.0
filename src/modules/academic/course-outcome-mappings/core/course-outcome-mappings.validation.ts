import { HttpException, HttpStatus } from '@nestjs/common';
import { CourseOutcomeMappingRepository } from './course-outcome-mappings.repository';
import { courseOutcomeMappingsValidationStrings } from '../config/strings/course-outcome-mappings.validation';

export class CourseOutcomeMappingValidation {
	static async validateCreate(repo: CourseOutcomeMappingRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				outcome_id: data.outcome_id,
				study_plan_course_id: data.study_plan_course_id,
			},
		});

		if (exists) errors.push(courseOutcomeMappingsValidationStrings.error.mappingExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: courseOutcomeMappingsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: CourseOutcomeMappingRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(courseOutcomeMappingsValidationStrings.error.notFound);

		if (data.outcome_id && data.study_plan_course_id) {
			const exists = await repo.findOneByCondition({
				where: {
					outcome_id: data.outcome_id,
					study_plan_course_id: data.study_plan_course_id,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(courseOutcomeMappingsValidationStrings.error.mappingExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: courseOutcomeMappingsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: CourseOutcomeMappingRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: courseOutcomeMappingsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
