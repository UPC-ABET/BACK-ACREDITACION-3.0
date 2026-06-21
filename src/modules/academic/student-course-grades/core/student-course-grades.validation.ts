import { BadRequestError } from 'src/commons/domain-error';
import { StudentCourseGradeRepository } from './student-course-grades.repository';
import { studentCourseGradesValidationStrings } from '../config/strings/student-course-grades.validation';

export class StudentCourseGradeValidation {
	static async validateCreate(repo: StudentCourseGradeRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				studentSectionEnrollmentId: data.studentSectionEnrollmentId,
				gradeTypeId: data.gradeTypeId,
			},
		});

		if (exists) errors.push(studentCourseGradesValidationStrings.error.gradeExists);

		if (data.gradeTypePercentage < 0) {
			errors.push(studentCourseGradesValidationStrings.error.invalidPercentage);
		}

		if (data.grade < 0) {
			errors.push(studentCourseGradesValidationStrings.error.invalidGrade);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: studentCourseGradesValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: StudentCourseGradeRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(studentCourseGradesValidationStrings.error.notFound);

		const enrollmentId = data.studentSectionEnrollmentId ?? entity?.studentSectionEnrollmentId;
		const gradeTypeId = data.gradeTypeId ?? entity?.gradeTypeId;

		const exists = await repo.findOneByCondition({
			where: {
				studentSectionEnrollmentId: enrollmentId,
				gradeTypeId: gradeTypeId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(studentCourseGradesValidationStrings.error.gradeExists);
		}

		const gradeTypePercentage = data.gradeTypePercentage ?? entity?.gradeTypePercentage;
		if (gradeTypePercentage < 0) {
			errors.push(studentCourseGradesValidationStrings.error.invalidPercentage);
		}

		const grade = data.grade ?? entity?.grade;
		if (grade < 0) {
			errors.push(studentCourseGradesValidationStrings.error.invalidGrade);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: studentCourseGradesValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: StudentCourseGradeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: studentCourseGradesValidationStrings.result.deleteFailed,
			});
		}
	}
}
