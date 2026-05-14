import { HttpException, HttpStatus } from '@nestjs/common';
import { StudentCourseGradeRepository } from './student-course-grades.repository';
import { studentCourseGradesValidationStrings } from '../config/strings/student-course-grades.validation';

export class StudentCourseGradeValidation {
	static async validateCreate(repo: StudentCourseGradeRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				student_section_enrollment_id: data.student_section_enrollment_id,
				grade_type_id: data.grade_type_id,
			},
		});

		if (exists) errors.push(studentCourseGradesValidationStrings.error.gradeExists);

		if (data.grade_type_percentage < 0) {
			errors.push(studentCourseGradesValidationStrings.error.invalidPercentage);
		}

		if (data.grade < 0) {
			errors.push(studentCourseGradesValidationStrings.error.invalidGrade);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: studentCourseGradesValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: StudentCourseGradeRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(studentCourseGradesValidationStrings.error.notFound);

		const enrollmentId = data.student_section_enrollment_id ?? entity?.student_section_enrollment_id;
		const gradeTypeId = data.grade_type_id ?? entity?.grade_type_id;

		const exists = await repo.findOneByCondition({
			where: {
				student_section_enrollment_id: enrollmentId,
				grade_type_id: gradeTypeId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(studentCourseGradesValidationStrings.error.gradeExists);
		}

		const gradeTypePercentage = data.grade_type_percentage ?? entity?.grade_type_percentage;
		if (gradeTypePercentage < 0) {
			errors.push(studentCourseGradesValidationStrings.error.invalidPercentage);
		}

		const grade = data.grade ?? entity?.grade;
		if (grade < 0) {
			errors.push(studentCourseGradesValidationStrings.error.invalidGrade);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: studentCourseGradesValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: StudentCourseGradeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: studentCourseGradesValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
