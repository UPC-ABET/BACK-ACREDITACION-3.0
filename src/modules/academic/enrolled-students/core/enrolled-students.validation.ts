import { BadRequestError, ConflictError, NotFoundError } from 'src/commons/domain-error';
import {
	EnrolledStudentRepository,
	EnrolledStudentDeleteBlockerCounts,
} from './enrolled-students.repository';
import { enrolledStudentsValidationStrings } from '../config/strings/enrolled-students.validation';
import { UpdateEnrolledStudentMaintenanceDto } from '../model/enrolled-students.dtos';
import { EnrolledStudentEntity } from '../model/enrolled-students.entity';

const DELETE_BLOCKER_KEYS: Array<[keyof EnrolledStudentDeleteBlockerCounts, string]> = [
	[
		'studentSectionEnrollments',
		enrolledStudentsValidationStrings.error.usedInStudentSectionEnrollments,
	],
];

export class EnrolledStudentValidation {
	static async validateCreate(repo: EnrolledStudentRepository, data: any) {
		const errors: Array<string> = [];

		// Keyed by (student, academic period) — resolved through study_plan_academic_periods —
		// rather than the exact studyPlanAcademicPeriodId, so a student cannot end up with two
		// active enrollments in the same period just because they resolve to different plans
		// (the exact loophole that produced duplicate enrollments; see
		// EnforceUniqueStudentEnrollmentPeriod1787164196191).
		const academicPeriodId = await repo.findAcademicPeriodId(data.studyPlanAcademicPeriodId);
		if (academicPeriodId) {
			const exists = await repo.findActiveEnrollmentInPeriod(data.studentId, academicPeriodId);
			if (exists) errors.push(enrolledStudentsValidationStrings.error.alreadyEnrolledInPeriod);
		}

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
			const academicPeriodId = await repo.findAcademicPeriodId(data.studyPlanAcademicPeriodId);
			if (academicPeriodId) {
				const exists = await repo.findActiveEnrollmentInPeriod(
					data.studentId,
					academicPeriodId,
					id,
				);
				if (exists) errors.push(enrolledStudentsValidationStrings.error.alreadyEnrolledInPeriod);
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
		academicPeriodId: number,
		studyPlanAcademicPeriodId: number | null,
		existingStudentId: number | null,
	) {
		const errors: Array<string> = [];

		if (!studyPlanAcademicPeriodId) {
			errors.push(enrolledStudentsValidationStrings.error.studyPlanPeriodNotFound);
		} else if (existingStudentId) {
			// Keyed by (student, academic period), not the exact plan — see validateCreate.
			const exists = await repo.findActiveEnrollmentInPeriod(existingStudentId, academicPeriodId);
			if (exists) errors.push(enrolledStudentsValidationStrings.error.alreadyEnrolledInPeriod);
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
	): Promise<EnrolledStudentEntity> {
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

		return entity;
	}

	// A program change moves the enrollment to a DIFFERENT study plan — the row's own
	// study_plan_academic_period_id must move with it (to the new program's plan for the SAME
	// academic period the row already belongs to), or it is left pointing at the old program's
	// plan while the student entity already reports the new program. That mismatch is exactly
	// what produced duplicate enrollments before EnforceUniqueStudentEnrollmentPeriod1787164196191:
	// a later upload/create for the new program would no longer match this row and would insert a
	// second one instead. Returns the resolved plan id for the caller to persist.
	static async resolveMaintenanceProgramChange(
		repo: EnrolledStudentRepository,
		entity: EnrolledStudentEntity,
		newProgramId: number,
	): Promise<number> {
		const academicPeriodId = await repo.findAcademicPeriodId(entity.studyPlanAcademicPeriodId);
		const newStudyPlanAcademicPeriodId = academicPeriodId
			? await repo.findStudyPlanAcademicPeriodId(newProgramId, academicPeriodId)
			: null;

		if (!academicPeriodId || !newStudyPlanAcademicPeriodId) {
			throw new BadRequestError({
				message: enrolledStudentsValidationStrings.result.updateFailed,
				errors: [enrolledStudentsValidationStrings.error.studyPlanPeriodNotFound],
			});
		}

		const conflict = await repo.findActiveEnrollmentInPeriod(
			entity.studentId,
			academicPeriodId,
			entity.id,
		);
		if (conflict) {
			throw new BadRequestError({
				message: enrolledStudentsValidationStrings.result.updateFailed,
				errors: [enrolledStudentsValidationStrings.error.alreadyEnrolledInPeriod],
			});
		}

		return newStudyPlanAcademicPeriodId;
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
