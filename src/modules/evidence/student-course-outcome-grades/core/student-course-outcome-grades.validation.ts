import { BadRequestError } from 'src/commons/domain-error';
import { StudentCourseOutcomeGradeRepository } from './student-course-outcome-grades.repository';
import { studentCourseOutcomeGradesValidationStrings } from '../config/strings/student-course-outcome-grades.validation';

export class StudentCourseOutcomeGradeValidation {
	static async validateCreate(repo: StudentCourseOutcomeGradeRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				studentSectionEnrollmentId: data.studentSectionEnrollmentId,
				outcomeId: data.outcomeId,
				evaluationId: data.evaluationId,
			},
		});

		if (exists) errors.push(studentCourseOutcomeGradesValidationStrings.error.gradeExists);

		if (data.grade < 0) {
			errors.push(studentCourseOutcomeGradesValidationStrings.error.invalidGrade);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: studentCourseOutcomeGradesValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: StudentCourseOutcomeGradeRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(studentCourseOutcomeGradesValidationStrings.error.notFound);

		const enrollmentId = data.studentSectionEnrollmentId ?? entity?.studentSectionEnrollmentId;
		const outcomeId = data.outcomeId ?? entity?.outcomeId;
		const evaluationId = data.evaluationId ?? entity?.evaluationId;

		const exists = await repo.findOneByCondition({
			where: {
				studentSectionEnrollmentId: enrollmentId,
				outcomeId: outcomeId,
				evaluationId: evaluationId,
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
			throw new BadRequestError({
				message: studentCourseOutcomeGradesValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: StudentCourseOutcomeGradeRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: studentCourseOutcomeGradesValidationStrings.result.deleteFailed,
			});
		}
	}
}
