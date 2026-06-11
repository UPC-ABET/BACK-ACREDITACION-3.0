import { HttpException, HttpStatus } from '@nestjs/common';
import { StudyPlanCourseRepository } from './study-plan-courses.repository';
import { studyPlanCoursesValidationStrings } from '../config/strings/study-plan-courses.validation';

export class StudyPlanCourseValidation {
	static async validateCreate(repo: StudyPlanCourseRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				studyPlanAcademicPeriodId: data.studyPlanAcademicPeriodId,
				courseId: data.courseId,
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

		if (data.studyPlanAcademicPeriodId && data.courseId) {
			const exists = await repo.findOneByCondition({
				where: {
					studyPlanAcademicPeriodId: data.studyPlanAcademicPeriodId,
					courseId: data.courseId,
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

	static async validateExists(repo: StudyPlanCourseRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: studyPlanCoursesValidationStrings.result.enableEvaluationFailed,
					errors: [studyPlanCoursesValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
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
