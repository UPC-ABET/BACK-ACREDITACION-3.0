import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { I18nText } from 'src/shared/types/i18n';
import { IfcValidation, IfcTransitionContext } from '../core/ifcs.validation';
import { ifcsValidationStrings } from '../config/strings/ifcs.validation';
import { IFC_OPS, IfcOp } from './ifcs.constants';
import { RejectIfcDto } from '../model/ifcs.dtos';
import { NotificationDispatcherService } from 'src/modules/ifc/notifications/notification-dispatcher.service';
import { IfcRepository } from '../core/ifcs.repository';

@Injectable()
export class IfcStateMachineService {
	constructor(
		private readonly repository: IfcRepository,
		private readonly dispatcher: NotificationDispatcherService,
	) {}

	async resolveCurrentStatusCode(chartId: number, periodId: number): Promise<string> {
		const code = await this.repository.resolveCurrentStatusCode(
			chartId,
			periodId,
			TYPE_CODES.IFC_STATUS.UNREGISTERED,
		);
		return code ?? TYPE_CODES.IFC_STATUS.UNREGISTERED;
	}

	async submit(ifcId: number, userId: number, schoolId: number) {
		const { ctx, periodId, statusCode } = await this.repository.transaction(async (em) => {
			await this.lockIfc(em, ifcId);
			const ctx = await this.loadTransitionContext(ifcId, userId, schoolId, IFC_OPS.SUBMIT, em);
			await IfcValidation.assertIsInCourseChain(em, ctx, IFC_OPS.SUBMIT);
			IfcValidation.assertCurrentStatus(
				ctx.currentStatusCode,
				[null, TYPE_CODES.IFC_STATUS.SAVED],
				IFC_OPS.SUBMIT,
			);
			const status = await this.insertStatus(
				em,
				ctx.ifcId,
				ctx.requesterStaffId,
				TYPE_CODES.IFC_STATUS.SUBMITTED,
				null,
			);

			const periodId = await this.repository.findIfcPeriodId(ifcId, em);
			return { ctx, periodId: Number(periodId), statusCode: status.code };
		});

		this.dispatcher.dispatchStatusChangeAsync({
			chartId: ctx.courseChartId,
			periodId,
			ifcStatusCode: statusCode,
			notifierUserId: userId,
			ifcId,
		});

		return { id: ifcId };
	}

	async approve(ifcId: number, userId: number, schoolId: number) {
		const { courseChartId, periodId, status } = await this.repository.transaction(async (em) => {
			await this.lockIfc(em, ifcId);
			const ctx = await this.loadTransitionContext(ifcId, userId, schoolId, IFC_OPS.APPROVE, em);
			await IfcValidation.assertHasHigherLevel(em, ctx, IFC_OPS.APPROVE);
			IfcValidation.assertCurrentStatus(
				ctx.currentStatusCode,
				[TYPE_CODES.IFC_STATUS.SUBMITTED],
				IFC_OPS.APPROVE,
			);
			const status = await this.insertStatus(
				em,
				ctx.ifcId,
				ctx.requesterStaffId,
				TYPE_CODES.IFC_STATUS.APPROVED,
				null,
			);
			const periodId = await this.repository.findIfcPeriodId(ifcId, em);
			return {
				courseChartId: ctx.courseChartId,
				periodId: Number(periodId),
				status,
			};
		});

		this.dispatcher.dispatchStatusChangeAsync({
			chartId: courseChartId,
			periodId,
			ifcStatusCode: status.code,
			notifierUserId: userId,
			ifcId,
		});

		return status;
	}

	async reject(ifcId: number, userId: number, schoolId: number, dto: RejectIfcDto) {
		const { courseChartId, periodId, status } = await this.repository.transaction(async (em) => {
			await this.lockIfc(em, ifcId);
			const ctx = await this.loadTransitionContext(ifcId, userId, schoolId, IFC_OPS.REJECT, em);
			await IfcValidation.assertHasHigherLevel(em, ctx, IFC_OPS.REJECT);
			IfcValidation.assertCurrentStatus(
				ctx.currentStatusCode,
				[TYPE_CODES.IFC_STATUS.SUBMITTED],
				IFC_OPS.REJECT,
			);
			const status = await this.insertStatus(
				em,
				ctx.ifcId,
				ctx.requesterStaffId,
				TYPE_CODES.IFC_STATUS.OBSERVED,
				dto.comment,
			);
			const periodId = await this.repository.findIfcPeriodId(ifcId, em);
			return {
				courseChartId: ctx.courseChartId,
				periodId: Number(periodId),
				status,
			};
		});

		this.dispatcher.dispatchStatusChangeAsync({
			chartId: courseChartId,
			periodId,
			ifcStatusCode: status.code,
			notifierUserId: userId,
			ifcId,
		});

		return status;
	}

	private async lockIfc(em: EntityManager, ifcId: number) {
		const rows = await this.repository.lockIfc(ifcId, em);
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
		const rows = await this.repository.findTransitionContextRows(ifcId, schoolId, userId, em);

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
			courseChartId: row.courseChartId == null ? null : Number(row.courseChartId),
			requesterStaffId: row.requesterStaffId == null ? null : Number(row.requesterStaffId),
			currentStatusCode: row.currentStatusCode ?? null,
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
		return this.repository.insertStatus(ifcId, newStatusCode, requesterStaffId, comment, em);
	}
}
