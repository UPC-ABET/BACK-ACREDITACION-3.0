import { BadRequestError, ConflictError, NotFoundError } from 'src/commons/domain-error';
import {
	StudyPlanCourseRepository,
	StudyPlanCourseDeleteBlockerCounts,
} from './study-plan-courses.repository';
import { studyPlanCoursesValidationStrings } from '../config/strings/study-plan-courses.validation';
import { CreateStudyPlanCourseMaintenanceDto } from '../model/study-plan-courses.dtos';

const DELETE_BLOCKER_KEYS: Array<[keyof StudyPlanCourseDeleteBlockerCounts, string]> = [
	['rubrics', studyPlanCoursesValidationStrings.error.usedInRubrics],
	['courseOutcomeMappings', studyPlanCoursesValidationStrings.error.usedInCourseOutcomeMappings],
];

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
			throw new BadRequestError({
				message: studyPlanCoursesValidationStrings.result.createFailed,
				errors,
			});
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
			throw new BadRequestError({
				message: studyPlanCoursesValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateExists(repo: StudyPlanCourseRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new NotFoundError({
				message: studyPlanCoursesValidationStrings.result.enableEvaluationFailed,
				errors: [studyPlanCoursesValidationStrings.error.notFound],
			});
		}
	}

	static async validateDelete(repo: StudyPlanCourseRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: studyPlanCoursesValidationStrings.result.deleteFailed,
			});
		}
	}

	static async validateMaintenanceCreate(
		repo: StudyPlanCourseRepository,
		studyPlanAcademicPeriodId: number | null,
		existingCourseId: number | null,
		data: CreateStudyPlanCourseMaintenanceDto,
	) {
		const errors: Array<string> = [];

		if (!studyPlanAcademicPeriodId) {
			errors.push(studyPlanCoursesValidationStrings.error.studyPlanPeriodNotFound);
		}

		const hasCourseId = data.courseId !== undefined && data.courseId !== null;
		const hasNewCourse = data.newCourse !== undefined && data.newCourse !== null;
		if (hasCourseId === hasNewCourse) {
			errors.push(studyPlanCoursesValidationStrings.error.courseSelectionInvalid);
		}

		if (studyPlanAcademicPeriodId && existingCourseId) {
			const exists = await repo.findOneByCondition({
				where: { studyPlanAcademicPeriodId, courseId: existingCourseId },
			});
			if (exists) errors.push(studyPlanCoursesValidationStrings.error.studyPlanCourseExists);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: studyPlanCoursesValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateMaintenanceDelete(repo: StudyPlanCourseRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new NotFoundError({
				message: studyPlanCoursesValidationStrings.result.deleteFailed,
				errors: [studyPlanCoursesValidationStrings.error.notFound],
			});
		}

		const counts = await repo.findDeleteBlockerCounts(id);
		const blockers = DELETE_BLOCKER_KEYS.filter(([key]) => counts[key] > 0).map(([, msg]) => msg);

		if (blockers.length > 0) {
			throw new ConflictError({
				message: studyPlanCoursesValidationStrings.error.inUse,
				errors: blockers,
			});
		}
	}
}
