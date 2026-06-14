import { HttpException, HttpStatus } from '@nestjs/common';
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
	static async validateCreate(repo: StudentSectionEnrollmentRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				enrolledStudentId: data.enrolledStudentId,
				courseSectionId: data.courseSectionId,
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

	static async validateMaintenanceUpdate(
		repo: StudentSectionEnrollmentRepository,
		id: number,
		data: UpdateStudentSectionEnrollmentMaintenanceDto,
	) {
		const entity = await repo.findOneById(id);
		if (!entity) {
			throw new HttpException(
				{
					message: studentSectionEnrollmentsValidationStrings.result.updateFailed,
					errors: [studentSectionEnrollmentsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
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
				throw new HttpException(
					{
						message: studentSectionEnrollmentsValidationStrings.result.updateFailed,
						errors: [studentSectionEnrollmentsValidationStrings.error.enrollmentExists],
					},
					HttpStatus.BAD_REQUEST,
				);
			}
		}
	}

	static async validateMaintenanceDelete(repo: StudentSectionEnrollmentRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: studentSectionEnrollmentsValidationStrings.result.deleteFailed,
					errors: [studentSectionEnrollmentsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}

		const counts = await repo.findDeleteBlockerCounts(id);
		const blockers = DELETE_BLOCKER_KEYS.filter(([key]) => counts[key] > 0).map(([, msg]) => msg);

		if (blockers.length > 0) {
			throw new HttpException(
				{
					message: studentSectionEnrollmentsValidationStrings.error.inUse,
					errors: blockers,
				},
				HttpStatus.CONFLICT,
			);
		}
	}
}
