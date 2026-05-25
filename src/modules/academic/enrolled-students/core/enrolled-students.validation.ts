import { HttpException, HttpStatus } from '@nestjs/common';
import { EnrolledStudentRepository } from './enrolled-students.repository';
import { enrolledStudentsValidationStrings } from '../config/strings/enrolled-students.validation';

export class EnrolledStudentValidation {
	static async validateCreate(repo: EnrolledStudentRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				student_id: data.student_id,
				study_plan_academic_period: data.study_plan_academic_period,
			},
		});

		if (exists) errors.push(enrolledStudentsValidationStrings.error.enrolledStudentExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: enrolledStudentsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: EnrolledStudentRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(enrolledStudentsValidationStrings.error.notFound);

		if (data.student_id && data.study_plan_academic_period) {
			const exists = await repo.findOneByCondition({
				where: {
					student_id: data.student_id,
					study_plan_academic_period: data.study_plan_academic_period,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(enrolledStudentsValidationStrings.error.enrolledStudentExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: enrolledStudentsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: EnrolledStudentRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: enrolledStudentsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
