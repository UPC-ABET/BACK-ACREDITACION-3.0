import { BadRequestError, ConflictError, NotFoundError } from 'src/commons/domain-error';
import {
	EnrolledStudentRepository,
	EnrolledStudentDeleteBlockerCounts,
} from './enrolled-students.repository';
import { enrolledStudentsValidationStrings } from '../config/strings/enrolled-students.validation';
import {
	UpdateEnrolledStudentMaintenanceDto,
	CreateEnrolledStudentMaintenanceDto,
} from '../model/enrolled-students.dtos';

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
				studyPlanAcademicPeriodId: data.studyPlanAcademicPeriodId,
			},
		});

		if (exists) errors.push(enrolledStudentsValidationStrings.error.enrolledStudentExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: enrolledStudentsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: EnrolledStudentRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(enrolledStudentsValidationStrings.error.notFound);

		if (data.studentId && data.studyPlanAcademicPeriodId) {
			const exists = await repo.findOneByCondition({
				where: {
					studentId: data.studentId,
					studyPlanAcademicPeriodId: data.studyPlanAcademicPeriodId,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(enrolledStudentsValidationStrings.error.enrolledStudentExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: enrolledStudentsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: EnrolledStudentRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: enrolledStudentsValidationStrings.result.deleteFailed,
			});
		}
	}

	static async validateMaintenanceCreate(
		repo: EnrolledStudentRepository,
		studyPlanAcademicPeriodId: number | null,
		existingStudentId: number | null,
		data: CreateEnrolledStudentMaintenanceDto,
	) {
		const errors: Array<string> = [];

		if (!studyPlanAcademicPeriodId) {
			errors.push(enrolledStudentsValidationStrings.error.studyPlanPeriodNotFound);
		} else if (existingStudentId) {
			const exists = await repo.findOneByCondition({
				where: {
					studentId: existingStudentId,
					studyPlanAcademicPeriodId: studyPlanAcademicPeriodId,
				},
			});
			if (exists) errors.push(enrolledStudentsValidationStrings.error.enrolledStudentExists);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: enrolledStudentsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateMaintenanceUpdate(
		repo: EnrolledStudentRepository,
		id: number,
		data: UpdateEnrolledStudentMaintenanceDto,
	) {
		const entity = await repo.findByIdWithRelations(id);
		if (!entity) {
			throw new NotFoundError({
				message: enrolledStudentsValidationStrings.result.updateFailed,
				errors: [enrolledStudentsValidationStrings.error.notFound],
			});
		}

		if (data.studentCode !== undefined && data.studentCode !== entity.student.code) {
			if (await repo.isStudentCodeTaken(data.studentCode, entity.studentId)) {
				throw new BadRequestError({
					message: enrolledStudentsValidationStrings.result.updateFailed,
					errors: [enrolledStudentsValidationStrings.error.codeExists],
				});
			}
		}
	}

	static async validateMaintenanceDelete(repo: EnrolledStudentRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new NotFoundError({
				message: enrolledStudentsValidationStrings.result.deleteFailed,
				errors: [enrolledStudentsValidationStrings.error.notFound],
			});
		}

		const counts = await repo.findDeleteBlockerCounts(id);
		const blockers = DELETE_BLOCKER_KEYS.filter(([key]) => counts[key] > 0).map(([, msg]) => msg);

		if (blockers.length > 0) {
			throw new ConflictError({
				message: enrolledStudentsValidationStrings.error.inUse,
				errors: blockers,
			});
		}
	}
}
