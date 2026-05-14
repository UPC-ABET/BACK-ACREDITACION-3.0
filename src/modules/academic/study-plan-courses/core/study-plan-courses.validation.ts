import { HttpException, HttpStatus } from '@nestjs/common';
import { StudyPlanCourseRepository } from './study-plan-courses.repository';
import { studyPlanCoursesValidationStrings } from '../config/strings/study-plan-courses.validation';

export class StudyPlanCourseValidation {
	static async validateCreate(repo: StudyPlanCourseRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				study_plan_academic_period_id: data.study_plan_academic_period_id,
				course_id: data.course_id,
			},
		});

		if (exists) errors.push(studyPlanCoursesValidationStrings.error.studyPlanCourseExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: studyPlanCoursesValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: StudyPlanCourseRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(studyPlanCoursesValidationStrings.error.notFound);

		if (data.study_plan_academic_period_id && data.course_id) {
			const exists = await repo.findOneByCondition({
				where: {
					study_plan_academic_period_id: data.study_plan_academic_period_id,
					course_id: data.course_id,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(studyPlanCoursesValidationStrings.error.studyPlanCourseExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: studyPlanCoursesValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: StudyPlanCourseRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: studyPlanCoursesValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
