import { BadRequestError, ConflictError, NotFoundError } from 'src/commons/domain-error';
import {
	StudentSectionEnrollmentRepository,
	StudentSectionEnrollmentDeleteBlockerCounts,
} from './student-section-enrollments.repository';
import { studentSectionEnrollmentsValidationStrings } from '../config/strings/student-section-enrollments.validation';
import {
	UpdateStudentSectionEnrollmentMaintenanceDto,
	CreateStudentSectionEnrollmentMaintenanceDto,
} from '../model/student-section-enrollments.dtos';

const DELETE_BLOCKER_KEYS: Array<[keyof StudentSectionEnrollmentDeleteBlockerCounts, string]> = [
	[
		'studentCourseGrades',
		studentSectionEnrollmentsValidationStrings.error.usedInStudentCourseGrades,
	],
	['projectStudents', studentSectionEnrollmentsValidationStrings.error.usedInProjectStudents],
	[
		'studentCourseOutcomeGrades',
		studentSectionEnrollmentsValidationStrings.error.usedInStudentCourseOutcomeGrades,
	],
];

export class StudentSectionEnrollmentValidation {
	private static async studyPlanEligibilityError(
		repo: StudentSectionEnrollmentRepository,
		enrolledStudentId: number,
		courseSectionId: number,
	): Promise<string | null> {
		const { periodMatches, courseInPlan } = await repo.checkStudyPlanEligibility(
			enrolledStudentId,
			courseSectionId,
		);
		if (!periodMatches) {
			return studentSectionEnrollmentsValidationStrings.error.studyPlanPeriodMismatch;
		}
		if (!courseInPlan) {
			return studentSectionEnrollmentsValidationStrings.error.courseNotInStudyPlan;
		}
		return null;
	}

	static async validateCreate(repo: StudentSectionEnrollmentRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				enrolledStudentId: data.enrolledStudentId,
				courseSectionId: data.courseSectionId,
			},
		});

		if (exists) errors.push(studentSectionEnrollmentsValidationStrings.error.enrollmentExists);

		if (data.enrolledStudentId && data.courseSectionId) {
			if (
				await repo.existsOtherEnrollmentInSameCoursePeriod(
					data.enrolledStudentId,
					data.courseSectionId,
				)
			) {
				errors.push(studentSectionEnrollmentsValidationStrings.error.alreadyEnrolledInCourse);
			}

			const eligibilityError = await this.studyPlanEligibilityError(
				repo,
				data.enrolledStudentId,
				data.courseSectionId,
			);
			if (eligibilityError) errors.push(eligibilityError);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: studentSectionEnrollmentsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: StudentSectionEnrollmentRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(studentSectionEnrollmentsValidationStrings.error.notFound);

		if (data.enrolledStudentId && data.courseSectionId) {
			const exists = await repo.findOneByCondition({
				where: {
					enrolledStudentId: data.enrolledStudentId,
					courseSectionId: data.courseSectionId,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(studentSectionEnrollmentsValidationStrings.error.enrollmentExists);
			}
		}

		if (entity) {
			const enrolledStudentId = data.enrolledStudentId ?? entity.enrolledStudentId;
			const courseSectionId = data.courseSectionId ?? entity.courseSectionId;
			const pairChanged =
				(data.enrolledStudentId !== undefined &&
					data.enrolledStudentId !== entity.enrolledStudentId) ||
				(data.courseSectionId !== undefined && data.courseSectionId !== entity.courseSectionId);

			if (pairChanged) {
				if (
					await repo.existsOtherEnrollmentInSameCoursePeriod(enrolledStudentId, courseSectionId, id)
				) {
					errors.push(studentSectionEnrollmentsValidationStrings.error.alreadyEnrolledInCourse);
				}

				const eligibilityError = await this.studyPlanEligibilityError(
					repo,
					enrolledStudentId,
					courseSectionId,
				);
				if (eligibilityError) errors.push(eligibilityError);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: studentSectionEnrollmentsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: StudentSectionEnrollmentRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: studentSectionEnrollmentsValidationStrings.result.deleteFailed,
			});
		}
	}

	static async validateMaintenanceCreate(
		repo: StudentSectionEnrollmentRepository,
		data: CreateStudentSectionEnrollmentMaintenanceDto,
	) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				enrolledStudentId: data.enrolledStudentId,
				courseSectionId: data.courseSectionId,
			},
		});
		if (exists) errors.push(studentSectionEnrollmentsValidationStrings.error.enrollmentExists);

		if (
			await repo.existsOtherEnrollmentInSameCoursePeriod(
				data.enrolledStudentId,
				data.courseSectionId,
			)
		) {
			errors.push(studentSectionEnrollmentsValidationStrings.error.alreadyEnrolledInCourse);
		}

		const eligibilityError = await this.studyPlanEligibilityError(
			repo,
			data.enrolledStudentId,
			data.courseSectionId,
		);
		if (eligibilityError) errors.push(eligibilityError);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: studentSectionEnrollmentsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateMaintenanceUpdate(
		repo: StudentSectionEnrollmentRepository,
		id: number,
		data: UpdateStudentSectionEnrollmentMaintenanceDto,
	) {
		const entity = await repo.findOneById(id);
		if (!entity) {
			throw new NotFoundError({
				message: studentSectionEnrollmentsValidationStrings.result.updateFailed,
				errors: [studentSectionEnrollmentsValidationStrings.error.notFound],
			});
		}

		const enrolledStudentId = data.enrolledStudentId ?? entity.enrolledStudentId;
		const courseSectionId = data.courseSectionId ?? entity.courseSectionId;
		const pairChanged =
			(data.enrolledStudentId !== undefined &&
				data.enrolledStudentId !== entity.enrolledStudentId) ||
			(data.courseSectionId !== undefined && data.courseSectionId !== entity.courseSectionId);

		if (pairChanged) {
			const exists = await repo.findOneByCondition({
				where: { enrolledStudentId, courseSectionId },
			});
			if (exists && exists.id !== id) {
				throw new BadRequestError({
					message: studentSectionEnrollmentsValidationStrings.result.updateFailed,
					errors: [studentSectionEnrollmentsValidationStrings.error.enrollmentExists],
				});
			}

			if (
				await repo.existsOtherEnrollmentInSameCoursePeriod(enrolledStudentId, courseSectionId, id)
			) {
				throw new BadRequestError({
					message: studentSectionEnrollmentsValidationStrings.result.updateFailed,
					errors: [studentSectionEnrollmentsValidationStrings.error.alreadyEnrolledInCourse],
				});
			}

			const eligibilityError = await this.studyPlanEligibilityError(
				repo,
				enrolledStudentId,
				courseSectionId,
			);
			if (eligibilityError) {
				throw new BadRequestError({
					message: studentSectionEnrollmentsValidationStrings.result.updateFailed,
					errors: [eligibilityError],
				});
			}
		}
	}

	static async validateMaintenanceDelete(repo: StudentSectionEnrollmentRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new NotFoundError({
				message: studentSectionEnrollmentsValidationStrings.result.deleteFailed,
				errors: [studentSectionEnrollmentsValidationStrings.error.notFound],
			});
		}

		const counts = await repo.findDeleteBlockerCounts(id);
		const blockers = DELETE_BLOCKER_KEYS.filter(([key]) => counts[key] > 0).map(([, msg]) => msg);

		if (blockers.length > 0) {
			throw new ConflictError({
				message: studentSectionEnrollmentsValidationStrings.error.inUse,
				errors: blockers,
			});
		}
	}
}
