import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { I18nText } from 'src/shared/types/i18n';
import { IfcValidation } from '../core/ifcs.validation';
import { ifcsValidationStrings } from '../config/strings/ifcs.validation';
import { IFCS_PARAMETER_KEYS, IFC_INSTRUMENT_CODE, IFC_OPS, IfcOp } from './ifcs.constants';
import { CreateIfcDto, IfcContentDto } from '../model/ifcs-content.dtos';
import { NotificationDispatcherService } from 'src/modules/ifc/notifications/notification-dispatcher.service';
import { IfcStateMachineService } from './ifc-state-machine.service';
import { IfcRepository } from '../core/ifcs.repository';

@Injectable()
export class IfcContentService {
	constructor(
		private readonly repository: IfcRepository,
		private readonly stateMachine: IfcStateMachineService,
		private readonly dispatcher: NotificationDispatcherService,
	) {}

	async createIfc(dto: CreateIfcDto, userId: number, schoolId: number, academicPeriodId: number) {
		const op: IfcOp = dto.submit ? IFC_OPS.SUBMIT : IFC_OPS.CREATE;
		IfcValidation.assertFindingsAndActionsPresent(dto.findings, dto.actions, op);
		const { id: ifcId, statusCode } = await this.repository.transaction(async (em) => {
			const chartRows = await this.repository.resolveChart(
				dto.chartId,
				academicPeriodId,
				schoolId,
				userId,
				em,
			);
			IfcValidation.assertChartFound(chartRows, op);

			const row = chartRows[0];
			const courseId = Number(row.courseId);
			const requesterStaffId = row.requesterStaffId === null ? null : Number(row.requesterStaffId);
			const programId = row.programId === null ? null : Number(row.programId);

			IfcValidation.assertRequesterIsStaff(requesterStaffId, op);
			await IfcValidation.assertIsInCourseChain(
				em,
				{
					ifcId: 0,
					courseChartId: dto.chartId,
					requesterStaffId,
					currentStatusCode: null,
				},
				op,
			);

			await IfcValidation.assertNoIfcExists(em, courseId, academicPeriodId, op);

			const ifcId = await this.repository.insertIfc(
				courseId,
				academicPeriodId,
				dto.information ?? {},
				em,
			);

			await this.resolveFindingsAndActions(em, {
				ifcId,
				courseId,
				periodId: academicPeriodId,
				programId,
				requesterStaffId: requesterStaffId!,
				op,
				findings: dto.findings,
				actions: dto.actions,
				deletedFindingIds: dto.deletedFindingIds,
				deletedActionIds: dto.deletedActionIds,
			});

			await this.applyPreviousActionEvidences(em, {
				courseId,
				periodId: academicPeriodId,
				excludeIfcId: null,
				items: dto.previousActions,
				op,
			});

			const newStatusCode = dto.submit
				? TYPE_CODES.IFC_STATUS.SUBMITTED
				: TYPE_CODES.IFC_STATUS.SAVED;
			const status = await this.stateMachine.insertStatus(
				em,
				ifcId,
				requesterStaffId!,
				newStatusCode,
				null,
			);

			return { id: ifcId, statusCode: status.code };
		});

		this.dispatcher.dispatchStatusChangeAsync({
			chartId: dto.chartId,
			periodId: academicPeriodId,
			ifcStatusCode: statusCode,
			notifierUserId: userId,
			ifcId,
		});

		return { id: ifcId };
	}

	async patch(id: number, dto: IfcContentDto, userId: number, schoolId: number) {
		const op: IfcOp = dto.submit ? IFC_OPS.SUBMIT : IFC_OPS.PATCH;
		IfcValidation.assertFindingsAndActionsPresent(dto.findings, dto.actions, op);
		const { courseChartId, periodId, statusCode } = await this.repository.transaction(
			async (em) => {
				const ctx = await this.stateMachine.loadTransitionContext(id, userId, schoolId, op, em);
				await IfcValidation.assertIsInCourseChain(em, ctx, op);
				IfcValidation.assertCurrentStatusEditable(ctx.currentStatusCode, op);

				const coursePeriod = await this.repository.findCoursePeriod(id, em);
				const courseId = Number(coursePeriod!.courseId);
				const periodId = Number(coursePeriod!.academicPeriodId);

				const programRows = await this.repository.findProgramByCoursePeriod(courseId, periodId, em);
				const programId =
					programRows[0]?.programId === undefined || programRows[0]?.programId === null
						? null
						: Number(programRows[0].programId);

				await this.repository.updateIfcInformation(id, dto.information ?? {}, em);

				await this.resolveFindingsAndActions(em, {
					ifcId: id,
					courseId,
					periodId,
					programId,
					requesterStaffId: ctx.requesterStaffId!,
					op,
					findings: dto.findings,
					actions: dto.actions,
					deletedFindingIds: dto.deletedFindingIds,
					deletedActionIds: dto.deletedActionIds,
				});

				await this.applyPreviousActionEvidences(em, {
					courseId,
					periodId,
					excludeIfcId: id,
					items: dto.previousActions,
					op,
				});

				const newStatusCode = dto.submit
					? TYPE_CODES.IFC_STATUS.SUBMITTED
					: TYPE_CODES.IFC_STATUS.SAVED;
				const status = await this.stateMachine.insertStatus(
					em,
					id,
					ctx.requesterStaffId!,
					newStatusCode,
					null,
				);

				return { courseChartId: ctx.courseChartId, periodId, statusCode: status.code };
			},
		);

		this.dispatcher.dispatchStatusChangeAsync({
			chartId: courseChartId,
			periodId,
			ifcStatusCode: statusCode,
			notifierUserId: userId,
			ifcId: id,
		});

		return { id };
	}

	private async resolveFindingsAndActions(
		em: EntityManager,
		input: {
			ifcId: number;
			courseId: number;
			periodId: number;
			programId: number | null;
			requesterStaffId: number;
			op: IfcOp;
			findings: {
				tempId: string;
				id: number | null;
				description: I18nText;
				criticalityCode: string;
			}[];
			actions: {
				tempId: string;
				id: number | null;
				description: I18nText;
				findingTempId: string;
			}[];
			deletedFindingIds?: number[];
			deletedActionIds?: number[];
		},
	) {
		await this.deleteFindingsAndActions(
			em,
			input.deletedFindingIds ?? [],
			input.deletedActionIds ?? [],
		);

		const ifcInstrumentId = await this.repository.findIfcInstrumentId(IFC_INSTRUMENT_CODE, em);
		if (!ifcInstrumentId) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result[`${input.op}Failed`],
					errors: [ifcsValidationStrings.error.ifcInstrumentMissing],
				},
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}

		const criticalityCodes = Array.from(new Set(input.findings.map((f) => f.criticalityCode)));
		const criticalityRows = criticalityCodes.length
			? await this.repository.findCriticalityTypes(criticalityCodes, em)
			: [];
		const criticalityByCode = new Map<string, number>(
			criticalityRows.map((r) => [r.code, Number(r.id)]),
		);

		const hasNewFinding = input.findings.some((f) => f.id === null);
		let nextFindingCorrelative = 0;
		if (hasNewFinding) {
			nextFindingCorrelative = await this.repository.maxFindingCorrelative(
				ifcInstrumentId,
				input.courseId,
				em,
			);
		}

		const tempIdToId = new Map<string, number>();
		for (const f of input.findings) {
			const critId = criticalityByCode.get(f.criticalityCode);
			if (!critId) {
				throw new HttpException(
					{
						message: ifcsValidationStrings.result[`${input.op}Failed`],
						errors: [`error.ifc.criticalityNotFound:${f.criticalityCode}`],
					},
					HttpStatus.BAD_REQUEST,
				);
			}

			let realId: number;
			if (f.id === null) {
				nextFindingCorrelative += 1;
				realId = await this.repository.insertFinding(
					{
						criticalityTypeId: critId,
						instrumentId: ifcInstrumentId,
						requesterStaffId: input.requesterStaffId,
						correlative: nextFindingCorrelative,
						description: f.description,
						courseId: input.courseId,
						periodId: input.periodId,
					},
					em,
				);

				await this.repository.linkIfcFinding(input.ifcId, realId, em);
			} else {
				await this.repository.updateFinding(f.id, f.description, critId, em);
				realId = f.id;
			}
			tempIdToId.set(f.tempId, realId);
		}

		const hasNewAction = input.actions.some((a) => a.id === null);
		let nextActionCorrelative = 0;
		if (hasNewAction) {
			nextActionCorrelative = await this.repository.maxActionCorrelative(
				ifcInstrumentId,
				input.courseId,
				em,
			);
		}

		for (const a of input.actions) {
			const findingId = tempIdToId.get(a.findingTempId);
			IfcValidation.assertFindingTempIdResolved(findingId, input.op);

			if (a.id === null) {
				nextActionCorrelative += 1;
				const actionId = await this.repository.insertAction(
					{
						description: a.description,
						correlative: nextActionCorrelative,
						programId: input.programId,
						periodId: input.periodId,
					},
					em,
				);

				await this.repository.linkFindingAction(findingId!, actionId, em);
			} else {
				await this.repository.updateAction(a.id, a.description, em);
				await this.repository.relinkFindingAction(findingId!, a.id, em);
			}
		}
	}

	private async applyPreviousActionEvidences(
		em: EntityManager,
		input: {
			courseId: number;
			periodId: number;
			excludeIfcId: number | null;
			items: { findingActionId: number; evidences: I18nText | null }[] | undefined;
			op: IfcOp;
		},
	) {
		const items = input.items ?? [];
		if (items.length === 0) return;

		const rows = await this.repository.findPreviousActionRows(
			input.courseId,
			input.periodId,
			input.excludeIfcId,
			IFCS_PARAMETER_KEYS.ACTION_PREFIX,
			TYPE_CODES.ACTION_COMPLETENESS.PENDING,
			TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED,
			IFCS_PARAMETER_KEYS.FINDING_PREFIX,
			em,
		);
		const allowed = new Set<number>(rows.map((r) => Number(r.findingActionId)));

		for (const item of items) {
			if (!allowed.has(item.findingActionId)) {
				throw new HttpException(
					{
						message:
							ifcsValidationStrings.result[
								input.op === IFC_OPS.PATCH ? 'patchFailed' : 'createFailed'
							],
						errors: [ifcsValidationStrings.error.previousActionNotEligible],
					},
					HttpStatus.BAD_REQUEST,
				);
			}
			await this.repository.updateFindingActionEvidences(item.findingActionId, item.evidences, em);
		}
	}

	private async deleteFindingsAndActions(
		em: EntityManager,
		findingIds: number[],
		actionIds: number[],
	) {
		for (const actionId of actionIds) {
			await this.repository.deleteAction(actionId, em);
		}
		for (const findingId of findingIds) {
			await this.repository.deleteFinding(findingId, em);
		}
	}
}
