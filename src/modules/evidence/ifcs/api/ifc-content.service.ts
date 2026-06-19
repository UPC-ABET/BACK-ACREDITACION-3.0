import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { I18nText } from 'src/shared/types/i18n';
import { IfcValidation } from '../core/ifcs.validation';
import { ifcsValidationStrings } from '../config/strings/ifcs.validation';
import { IFCS_PARAMETER_KEYS, IFC_INSTRUMENT_CODE, IFC_OPS, IfcOp } from './ifcs.constants';
import { CreateIfcDto, IfcContentDto } from '../model/ifcs-content.dtos';
import { NotificationDispatcherService } from 'src/modules/ifc/notifications/notification-dispatcher.service';
import { IfcStateMachineService } from './ifc-state-machine.service';
import {
	CHART_RESOLUTION_SQL,
	PROGRAM_BY_COURSE_PERIOD_SQL,
	PREVIOUS_ACTIONS_SQL,
} from './ifcs.sql';

@Injectable()
export class IfcContentService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly stateMachine: IfcStateMachineService,
		private readonly dispatcher: NotificationDispatcherService,
	) {}

	async createIfc(dto: CreateIfcDto, userId: number, schoolId: number, academicPeriodId: number) {
		const op: IfcOp = dto.submit ? IFC_OPS.SUBMIT : IFC_OPS.CREATE;
		IfcValidation.assertFindingsAndActionsPresent(dto.findings, dto.actions, op);
		const { id: ifcId, statusCode } = await this.dataSource.transaction(async (em) => {
			const chartRows = await em.query(CHART_RESOLUTION_SQL, [
				dto.chartId,
				academicPeriodId,
				schoolId,
				TYPE_CODES.ENTITY_TYPE.COURSE,
				TYPE_CODES.ENTITY_TYPE.SCHOOL,
				userId,
			]);
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

			const ifcInsert = await em.query(
				`INSERT INTO evidence.ifcs (course_id, academic_period_id, information, extra, is_active) VALUES ($1, $2, $3::jsonb, '{}'::jsonb, true) RETURNING id`,
				[courseId, academicPeriodId, JSON.stringify(dto.information ?? {})],
			);
			const ifcId = Number(ifcInsert[0].id);

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
		const { courseChartId, periodId, statusCode } = await this.dataSource.transaction(
			async (em) => {
				const ctx = await this.stateMachine.loadTransitionContext(id, userId, schoolId, op, em);
				await IfcValidation.assertIsInCourseChain(em, ctx, op);
				IfcValidation.assertCurrentStatusEditable(ctx.currentStatusCode, op);

				const ifcRows = await em.query(
					`SELECT course_id AS "courseId", academic_period_id AS "academicPeriodId" FROM evidence.ifcs WHERE id = $1`,
					[id],
				);
				const courseId = Number(ifcRows[0].courseId);
				const periodId = Number(ifcRows[0].academicPeriodId);

				const programRows = await em.query(PROGRAM_BY_COURSE_PERIOD_SQL, [
					courseId,
					periodId,
					TYPE_CODES.ENTITY_TYPE.COURSE,
				]);
				const programId =
					programRows[0]?.programId === undefined || programRows[0]?.programId === null
						? null
						: Number(programRows[0].programId);

				await em.query(
					`UPDATE evidence.ifcs SET information = $1::jsonb, updated_at = NOW() WHERE id = $2`,
					[JSON.stringify(dto.information ?? {}), id],
				);

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

		const instrumentRows = await em.query(
			`SELECT id::int AS id FROM evidence.instruments WHERE code = $1 AND is_active = true LIMIT 1`,
			[IFC_INSTRUMENT_CODE],
		);
		const ifcInstrumentId: number | undefined = instrumentRows[0]?.id;
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
			? await em.query(`SELECT id::int AS id, code FROM core.types WHERE code = ANY($1::text[])`, [
					criticalityCodes,
				])
			: [];
		const criticalityByCode = new Map<string, number>(
			criticalityRows.map((r: any) => [r.code, Number(r.id)]),
		);

		const hasNewFinding = input.findings.some((f) => f.id === null);
		let nextFindingCorrelative = 0;
		if (hasNewFinding) {
			const base = await em.query(
				`SELECT COALESCE(MAX(correlative), 0)::int AS c
				 FROM improvement.findings
				 WHERE instrument_id = $1
				   AND ((course_id IS NULL AND $2::int IS NULL) OR course_id = $2)`,
				[ifcInstrumentId, input.courseId],
			);
			nextFindingCorrelative = Number(base[0]?.c ?? 0);
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
				const insertRow = await em.query(
					`INSERT INTO improvement.findings (criticality_type_id, instrument_id, staff_id, correlative, description, course_id, academic_period_id, campus_id, is_automatic, is_active)
					 VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NULL, false, true)
					 RETURNING id`,
					[
						critId,
						ifcInstrumentId,
						input.requesterStaffId,
						nextFindingCorrelative,
						JSON.stringify(f.description),
						input.courseId,
						input.periodId,
					],
				);
				realId = Number(insertRow[0].id);

				await em.query(
					`INSERT INTO ifc.ifc_findings (ifc_id, finding_id, is_active)
					 SELECT $1, $2, true
					 WHERE NOT EXISTS (SELECT 1 FROM ifc.ifc_findings WHERE ifc_id = $1 AND finding_id = $2)`,
					[input.ifcId, realId],
				);
			} else {
				await em.query(
					`UPDATE improvement.findings SET description = $1::jsonb, criticality_type_id = $2, updated_at = NOW() WHERE id = $3`,
					[JSON.stringify(f.description), critId, f.id],
				);
				realId = f.id;
			}
			tempIdToId.set(f.tempId, realId);
		}

		const hasNewAction = input.actions.some((a) => a.id === null);
		let nextActionCorrelative = 0;
		if (hasNewAction) {
			const base = await em.query(
				`SELECT COALESCE(MAX(a.correlative), 0)::int AS c
				 FROM improvement.actions a
				 JOIN improvement.finding_actions fa ON fa.action_id = a.id
				 JOIN improvement.findings f         ON f.id          = fa.finding_id
				 WHERE f.instrument_id = $1
				   AND ((f.course_id IS NULL AND $2::int IS NULL) OR f.course_id = $2)`,
				[ifcInstrumentId, input.courseId],
			);
			nextActionCorrelative = Number(base[0]?.c ?? 0);
		}

		for (const a of input.actions) {
			const findingId = tempIdToId.get(a.findingTempId);
			IfcValidation.assertFindingTempIdResolved(findingId, input.op);

			if (a.id === null) {
				nextActionCorrelative += 1;
				const insertedAction = await em.query(
					`INSERT INTO improvement.actions (description, correlative, program_id, academic_period_id, is_active)
					 VALUES ($1::jsonb, $2, $3, $4, true)
					 RETURNING id`,
					[JSON.stringify(a.description), nextActionCorrelative, input.programId, input.periodId],
				);
				const actionId = Number(insertedAction[0].id);

				await em.query(
					`INSERT INTO improvement.finding_actions (finding_id, action_id, in_plan_required, evidences, is_active)
					 VALUES ($1, $2, false, NULL, true)`,
					[findingId, actionId],
				);
			} else {
				await em.query(
					`UPDATE improvement.actions SET description = $1::jsonb, updated_at = NOW() WHERE id = $2`,
					[JSON.stringify(a.description), a.id],
				);
				await em.query(
					`UPDATE improvement.finding_actions SET finding_id = $1 WHERE action_id = $2 AND finding_id <> $1`,
					[findingId, a.id],
				);
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

		const rows = await em.query(PREVIOUS_ACTIONS_SQL, [
			input.courseId,
			input.periodId,
			input.excludeIfcId,
			IFCS_PARAMETER_KEYS.ACTION_PREFIX,
			TYPE_CODES.ACTION_COMPLETENESS.PENDING,
			TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED,
			IFCS_PARAMETER_KEYS.FINDING_PREFIX,
		]);
		const allowed = new Set<number>(rows.map((r: any) => Number(r.findingActionId)));

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
			await em.query(
				`UPDATE improvement.finding_actions SET evidences = $1::jsonb, updated_at = NOW() WHERE id = $2`,
				[item.evidences === null ? null : JSON.stringify(item.evidences), item.findingActionId],
			);
		}
	}

	private async deleteFindingsAndActions(
		em: EntityManager,
		findingIds: number[],
		actionIds: number[],
	) {
		for (const actionId of actionIds) {
			await em.query(`DELETE FROM improvement.finding_actions WHERE action_id = $1`, [actionId]);
			await em.query(`DELETE FROM improvement.actions WHERE id = $1`, [actionId]);
		}
		for (const findingId of findingIds) {
			await em.query(`DELETE FROM improvement.finding_outcomes WHERE finding_id = $1`, [findingId]);
			await em.query(`DELETE FROM improvement.finding_actions WHERE finding_id = $1`, [findingId]);
			await em.query(`DELETE FROM ifc.ifc_findings WHERE finding_id = $1`, [findingId]);
			await em.query(`DELETE FROM improvement.findings WHERE id = $1`, [findingId]);
		}
	}
}
