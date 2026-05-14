import { HttpException, HttpStatus } from '@nestjs/common';
import { StudentSectionEnrollmentRepository } from './student-section-enrollments.repository';
import { studentSectionEnrollmentsValidationStrings } from '../config/strings/student-section-enrollments.validation';

export class StudentSectionEnrollmentValidation {
	static async validateCreate(repo: StudentSectionEnrollmentRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				enrolled_student_id: data.enrolled_student_id,
				course_section_id: data.course_section_id,
			},
		});

		if (exists) errors.push(studentSectionEnrollmentsValidationStrings.error.enrollmentExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: studentSectionEnrollmentsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: StudentSectionEnrollmentRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(studentSectionEnrollmentsValidationStrings.error.notFound);

		if (data.enrolled_student_id && data.course_section_id) {
			const exists = await repo.findOneByCondition({
				where: {
					enrolled_student_id: data.enrolled_student_id,
					course_section_id: data.course_section_id,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(studentSectionEnrollmentsValidationStrings.error.enrollmentExists);
			}
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: studentSectionEnrollmentsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: StudentSectionEnrollmentRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: studentSectionEnrollmentsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
