import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { I18nText } from 'src/shared/types/i18n';
import { IfcValidation, IfcTransitionContext } from '../core/ifcs.validation';
import { ifcsValidationStrings } from '../config/strings/ifcs.validation';
import { IFC_OPS, IfcOp } from './ifcs.constants';
import { RejectIfcDto } from '../model/ifcs.dtos';
import {
	NotificationDispatcherService,
	DispatchResult,
} from 'src/modules/ifc/notifications/notification-dispatcher.service';
import { TRANSITION_CONTEXT_SQL, INSERT_STATUS_SQL } from './ifcs.sql';

@Injectable()
export class IfcStateMachineService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly dispatcher: NotificationDispatcherService,
	) {}

	async resolveCurrentStatusCode(chartId: number, periodId: number): Promise<string> {
		const rows = await this.dataSource.query(
			`
			SELECT COALESCE(
				(SELECT t.code FROM ifc.statuses s
				   JOIN core.types t ON t.id = s.status_type_id
				   JOIN evidence.ifcs i ON i.id = s.ifc_id
				   JOIN organization.charts c ON c.entity_code = i.course_id AND c.academic_period_id = i.academic_period_id
				   WHERE c.id = $1 AND i.academic_period_id = $2
				   ORDER BY s.register_at DESC LIMIT 1),
				$3
			) AS code
			`,
			[chartId, periodId, TYPE_CODES.IFC_STATUS.UNREGISTERED],
		);
		return rows[0]?.code ?? TYPE_CODES.IFC_STATUS.UNREGISTERED;
	}

	async submit(ifcId: number, userId: number, schoolId: number) {
		const { ctx, periodId } = await this.dataSource.transaction(async (em) => {
			await this.lockIfc(em, ifcId);
			const ctx = await this.loadTransitionContext(ifcId, userId, schoolId, IFC_OPS.SUBMIT, em);
			await IfcValidation.assertIsInCourseChain(em, ctx, IFC_OPS.SUBMIT);
			IfcValidation.assertCurrentStatus(
				ctx.currentStatusCode,
				[null, TYPE_CODES.IFC_STATUS.SAVED],
				IFC_OPS.SUBMIT,
			);
			await this.insertStatus(
				em,
				ctx.ifcId,
				ctx.requesterStaffId,
				TYPE_CODES.IFC_STATUS.SUBMITTED,
				null,
			);

			const periodRows = await em.query(
				`SELECT academic_period_id FROM evidence.ifcs WHERE id = $1 LIMIT 1`,
				[ifcId],
			);
			return { ctx, periodId: Number(periodRows[0]?.academic_period_id) };
		});

		const notification: DispatchResult =
			ctx.courseChartId !== null && Number.isFinite(periodId)
				? await this.dispatcher.dispatch({
						chartId: ctx.courseChartId,
						periodId,
						triggerCode: TYPE_CODES.NOTIFICATION_TRIGGER.AUTO_STATUS_CHANGE,
						ifcStatusCode: TYPE_CODES.IFC_STATUS.SUBMITTED,
						notifierUserId: userId,
					})
				: { sent: false, recipients_count: 0, cc_count: 0, reason: 'no_course_chart' };

		return { id: ifcId, notification };
	}

	async approve(ifcId: number, userId: number, schoolId: number) {
		return await this.dataSource.transaction(async (em) => {
			await this.lockIfc(em, ifcId);
			const ctx = await this.loadTransitionContext(ifcId, userId, schoolId, IFC_OPS.APPROVE, em);
			IfcValidation.assertNotOwnCoordinator(ctx, IFC_OPS.APPROVE);
			IfcValidation.assertCurrentStatus(
				ctx.currentStatusCode,
				[TYPE_CODES.IFC_STATUS.SUBMITTED],
				IFC_OPS.APPROVE,
			);
			return await this.insertStatus(
				em,
				ctx.ifcId,
				ctx.requesterStaffId,
				TYPE_CODES.IFC_STATUS.APPROVED,
				null,
			);
		});
	}

	async reject(ifcId: number, userId: number, schoolId: number, dto: RejectIfcDto) {
		return await this.dataSource.transaction(async (em) => {
			await this.lockIfc(em, ifcId);
			const ctx = await this.loadTransitionContext(ifcId, userId, schoolId, IFC_OPS.REJECT, em);
			IfcValidation.assertNotOwnCoordinator(ctx, IFC_OPS.REJECT);
			IfcValidation.assertCurrentStatus(
				ctx.currentStatusCode,
				[TYPE_CODES.IFC_STATUS.SUBMITTED],
				IFC_OPS.REJECT,
			);
			return await this.insertStatus(
				em,
				ctx.ifcId,
				ctx.requesterStaffId,
				TYPE_CODES.IFC_STATUS.OBSERVED,
				dto.comment,
			);
		});
	}

	private async lockIfc(em: EntityManager, ifcId: number) {
		const rows = await em.query(`SELECT id FROM evidence.ifcs WHERE id = $1 FOR UPDATE`, [ifcId]);
		if (rows.length === 0) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result.submitFailed,
					errors: [ifcsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}
	}

	async loadTransitionContext(
		ifcId: number,
		userId: number,
		schoolId: number,
		op: IfcOp,
		em?: EntityManager,
	): Promise<IfcTransitionContext> {
		const params = [
			ifcId,
			schoolId,
			userId,
			TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
		];
		const rows = em
			? await em.query(TRANSITION_CONTEXT_SQL, params)
			: await this.dataSource.query(TRANSITION_CONTEXT_SQL, params);

		if (rows.length === 0) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result[`${op}Failed`],
					errors: [ifcsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}

		const row = rows[0];
		const ctx: IfcTransitionContext = {
			ifcId,
			ifcCourseStaffId: row.ifc_course_staff_id == null ? null : Number(row.ifc_course_staff_id),
			courseChartId: row.course_chart_id == null ? null : Number(row.course_chart_id),
			requesterStaffId: row.requester_staff_id == null ? null : Number(row.requester_staff_id),
			currentStatusCode: row.current_status_code ?? null,
		};

		IfcValidation.assertRequesterIsStaff(ctx.requesterStaffId, op);
		return ctx;
	}

	async insertStatus(
		em: EntityManager | undefined,
		ifcId: number,
		requesterStaffId: number | null,
		newStatusCode: string,
		comment: I18nText | null,
	) {
		const params = [
			ifcId,
			newStatusCode,
			requesterStaffId,
			comment ? JSON.stringify(comment) : null,
		];
		const rows = em
			? await em.query(INSERT_STATUS_SQL, params)
			: await this.dataSource.query(INSERT_STATUS_SQL, params);
		return rows[0];
	}
}
