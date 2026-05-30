import { HttpException, HttpStatus } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { IfcRepository } from './ifcs.repository';
import { ifcsValidationStrings } from '../config/strings/ifcs.validation';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { IFC_OPS, IfcOp } from '../api/ifcs.constants';

export type IfcTransitionOp =
	| typeof IFC_OPS.SUBMIT
	| typeof IFC_OPS.APPROVE
	| typeof IFC_OPS.REJECT;
export type IfcEditOp = typeof IFC_OPS.CREATE | typeof IFC_OPS.PATCH;
export type IfcChainOp = typeof IFC_OPS.SUBMIT | typeof IFC_OPS.PATCH | typeof IFC_OPS.CREATE;

export interface SqlRunner {
	query(sql: string, params?: any[]): Promise<any>;
}

export interface IfcTransitionContext {
	ifcId: number;
	ifcCourseStaffId: number | null;
	courseChartId: number | null;
	requesterStaffId: number | null;
	currentStatusCode: string | null;
}

export class IfcValidation {
	static async validateCreate(repo: IfcRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				courseId: data.courseId,
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

		const studyPlanCourseId = data.courseId ?? entity?.courseId;

		const exists = await repo.findOneByCondition({
			where: {
				courseId: studyPlanCourseId,
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

	static assertCurrentStatus(currentCode: string | null, allowed: (string | null)[], op: IfcOp) {
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

	static assertRequesterIsStaff(requesterStaffId: number | null, op: IfcOp) {
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

	static assertNotOwnCoordinator(
		ctx: IfcTransitionContext,
		op: typeof IFC_OPS.APPROVE | typeof IFC_OPS.REJECT,
	) {
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

	static assertCurrentStatusEditable(currentCode: string | null, op: IfcOp) {
		const editable: (string | null)[] = [
			TYPE_CODES.IFC_STATUS.SAVED,
			TYPE_CODES.IFC_STATUS.OBSERVED,
		];
		if (!editable.includes(currentCode)) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result[`${op}Failed`],
					errors: [ifcsValidationStrings.error.notEditable],
				},
				HttpStatus.CONFLICT,
			);
		}
	}

	static async assertNoIfcExists(em: EntityManager, courseId: number, periodId: number, op: IfcOp) {
		const rows = await em.query(
			`SELECT 1 FROM evidence.ifcs WHERE course_id = $1 AND academic_period_id = $2 LIMIT 1`,
			[courseId, periodId],
		);
		if (rows.length > 0) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result[`${op}Failed`],
					errors: [ifcsValidationStrings.error.alreadyExists],
				},
				HttpStatus.CONFLICT,
			);
		}
	}

	static assertChartFound<T>(rows: T[], op: IfcOp | 'prefill') {
		if (rows.length === 0) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result[`${op}Failed`],
					errors: [ifcsValidationStrings.error.chartNotFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}
	}

	static async assertIsInCourseChain(runner: SqlRunner, ctx: IfcTransitionContext, op: IfcOp) {
		if (ctx.courseChartId == null || ctx.requesterStaffId == null) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result[`${op}Failed`],
					errors: [ifcsValidationStrings.error.notInChain],
				},
				HttpStatus.FORBIDDEN,
			);
		}
		const rows = await runner.query(
			`WITH RECURSIVE chain_up AS (
				SELECT id, root_chart_detail_id, staff_id
				FROM organization.charts
				WHERE id = $1 AND is_active = true

				UNION ALL

				SELECT c.id, c.root_chart_detail_id, c.staff_id
				FROM organization.charts c
				JOIN chain_up cu ON c.id = cu.root_chart_detail_id
				WHERE c.is_active = true
			)
			SELECT 1 FROM chain_up WHERE staff_id = $2 LIMIT 1`,
			[ctx.courseChartId, ctx.requesterStaffId],
		);

		if (rows.length === 0) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result[`${op}Failed`],
					errors: [ifcsValidationStrings.error.notInChain],
				},
				HttpStatus.FORBIDDEN,
			);
		}
	}

	static assertFindingsAndActionsPresent(
		findings: { tempId: string }[],
		actions: { findingTempId: string }[],
		op: IfcOp,
	) {
		const errors: string[] = [];

		if (!findings || findings.length === 0) {
			errors.push(ifcsValidationStrings.error.findingsRequired);
		} else {
			const actionsByFinding = new Set((actions ?? []).map((a) => a.findingTempId));
			const orphanFinding = findings.find((f) => !actionsByFinding.has(f.tempId));
			if (orphanFinding) errors.push(ifcsValidationStrings.error.actionsRequiredPerFinding);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result[`${op}Failed`],
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static assertFindingTempIdResolved(realId: number | undefined, op: IfcOp) {
		if (realId === undefined) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result[`${op}Failed`],
					errors: [ifcsValidationStrings.error.findingTempIdMissing],
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
