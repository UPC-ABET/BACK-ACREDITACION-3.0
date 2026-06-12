import { HttpException, HttpStatus } from '@nestjs/common';
import {
	EnrolledStudentRepository,
	EnrolledStudentDeleteBlockerCounts,
} from './enrolled-students.repository';
import { enrolledStudentsValidationStrings } from '../config/strings/enrolled-students.validation';
import { UpdateEnrolledStudentMaintenanceDto } from '../model/enrolled-students.dtos';

const DELETE_BLOCKER_KEYS: Array<[keyof EnrolledStudentDeleteBlockerCounts, string]> = [
	[
		'studentSectionEnrollments',
		enrolledStudentsValidationStrings.error.usedInStudentSectionEnrollments,
	],
];

export class EnrolledStudentValidation {
	static async validateCreate(repo: EnrolledStudentRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				studentId: data.studentId,
				studyPlanAcademicPeriod: data.studyPlanAcademicPeriod,
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

		if (data.studentId && data.studyPlanAcademicPeriod) {
			const exists = await repo.findOneByCondition({
				where: {
					studentId: data.studentId,
					studyPlanAcademicPeriod: data.studyPlanAcademicPeriod,
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

	static async validateMaintenanceUpdate(
		repo: EnrolledStudentRepository,
		id: number,
		data: UpdateEnrolledStudentMaintenanceDto,
	) {
		const entity = await repo.findByIdWithRelations(id);
		if (!entity) {
			throw new HttpException(
				{
					message: enrolledStudentsValidationStrings.result.updateFailed,
					errors: [enrolledStudentsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}

		if (data.studentCode !== undefined && data.studentCode !== entity.student.code) {
			if (await repo.isStudentCodeTaken(data.studentCode, entity.studentId)) {
				throw new HttpException(
					{
						message: enrolledStudentsValidationStrings.result.updateFailed,
						errors: [enrolledStudentsValidationStrings.error.codeExists],
					},
					HttpStatus.BAD_REQUEST,
				);
			}
		}
	}

	static async validateMaintenanceDelete(repo: EnrolledStudentRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: enrolledStudentsValidationStrings.result.deleteFailed,
					errors: [enrolledStudentsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}

		const counts = await repo.findDeleteBlockerCounts(id);
		const blockers = DELETE_BLOCKER_KEYS.filter(([key]) => counts[key] > 0).map(([, msg]) => msg);

		if (blockers.length > 0) {
			throw new HttpException(
				{
					message: enrolledStudentsValidationStrings.error.inUse,
					errors: blockers,
				},
				HttpStatus.CONFLICT,
			);
		}
	}
}
