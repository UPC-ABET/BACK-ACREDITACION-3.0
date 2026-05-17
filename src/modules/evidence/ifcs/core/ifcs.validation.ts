import { HttpException, HttpStatus } from '@nestjs/common';
import { IfcRepository } from './ifcs.repository';
import { ifcsValidationStrings } from '../config/strings/ifcs.validation';

export type IfcTransitionOp = 'submit' | 'approve' | 'reject';

export interface IfcTransitionContext {
	ifcId: number;
	ifcCourseStaffId: number | null;
	requesterStaffId: number | null;
	currentStatusCode: string | null;
}

export class IfcValidation {
	static async validateCreate(repo: IfcRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				study_plan_course_id: data.study_plan_course_id,
			},
		});

		if (exists) errors.push(ifcsValidationStrings.error.ifcExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: IfcRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(ifcsValidationStrings.error.notFound);

		const studyPlanCourseId = data.study_plan_course_id ?? entity?.study_plan_course_id;

		const exists = await repo.findOneByCondition({
			where: {
				study_plan_course_id: studyPlanCourseId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(ifcsValidationStrings.error.ifcExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: IfcRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static assertCurrentStatus(currentCode: string | null, allowed: (string | null)[], op: IfcTransitionOp) {
		if (!allowed.includes(currentCode)) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result[`${op}Failed`],
					errors: [ifcsValidationStrings.error.invalidTransition],
				},
				HttpStatus.CONFLICT,
			);
		}
	}

	static assertRequesterIsStaff(requesterStaffId: number | null, op: IfcTransitionOp) {
		if (!requesterStaffId) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result[`${op}Failed`],
					errors: [ifcsValidationStrings.error.staffRequired],
				},
				HttpStatus.FORBIDDEN,
			);
		}
	}

	static assertOwnCoordinator(ctx: IfcTransitionContext, _op: 'submit') {
		if (ctx.requesterStaffId == null || ctx.requesterStaffId !== ctx.ifcCourseStaffId) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result.submitFailed,
					errors: [ifcsValidationStrings.error.notOwnCoordinator],
				},
				HttpStatus.FORBIDDEN,
			);
		}
	}

	static assertNotOwnCoordinator(ctx: IfcTransitionContext, op: 'approve' | 'reject') {
		if (ctx.requesterStaffId != null && ctx.requesterStaffId === ctx.ifcCourseStaffId) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result[`${op}Failed`],
					errors: [ifcsValidationStrings.error.ownCoordinatorForbidden],
				},
				HttpStatus.FORBIDDEN,
			);
		}
	}
}
