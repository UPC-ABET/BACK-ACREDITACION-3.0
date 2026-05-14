import { HttpException, HttpStatus } from '@nestjs/common';
import { StudentCourseOutcomeGradeRepository } from './student-course-outcome-grades.repository';
import { studentCourseOutcomeGradesValidationStrings } from '../config/strings/student-course-outcome-grades.validation';

export class StudentCourseOutcomeGradeValidation {
	static async validateCreate(repo: StudentCourseOutcomeGradeRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				student_section_enrollment_id: data.student_section_enrollment_id,
				outcome_id: data.outcome_id,
			},
		});

		if (exists) errors.push(studentCourseOutcomeGradesValidationStrings.error.gradeExists);

		if (data.grade < 0) {
			errors.push(studentCourseOutcomeGradesValidationStrings.error.invalidGrade);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: studentCourseOutcomeGradesValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: StudentCourseOutcomeGradeRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(studentCourseOutcomeGradesValidationStrings.error.notFound);

		const enrollmentId = data.student_section_enrollment_id ?? entity?.student_section_enrollment_id;
		const outcomeId = data.outcome_id ?? entity?.outcome_id;

		const exists = await repo.findOneByCondition({
			where: {
				student_section_enrollment_id: enrollmentId,
				outcome_id: outcomeId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(studentCourseOutcomeGradesValidationStrings.error.gradeExists);
		}

		const grade = data.grade ?? entity?.grade;
		if (grade < 0) {
			errors.push(studentCourseOutcomeGradesValidationStrings.error.invalidGrade);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: studentCourseOutcomeGradesValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: StudentCourseOutcomeGradeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: studentCourseOutcomeGradesValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
