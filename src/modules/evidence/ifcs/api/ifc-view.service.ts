import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { I18nText } from 'src/shared/types/i18n';
import { ifcsValidationStrings } from '../config/strings/ifcs.validation';
import { IFCS_PARAMETER_KEYS } from './ifcs.constants';
import {
	HEADER_SQL,
	FINDINGS_SQL,
	FINDING_OUTCOMES_SQL,
	FINDING_ACTIONS_SQL,
	OUTCOME_COURSE_BY_IFC_SQL,
	PREVIOUS_ACTIONS_SQL,
} from './ifcs.sql';

@Injectable()
export class IfcViewService {
	constructor(private readonly dataSource: DataSource) {}

	async getView(id: number, userId: number, schoolId: number) {
		const [headerRows, findingRows, outcomeCourseRows] = await Promise.all([
			this.dataSource.query(HEADER_SQL, [
				id,
				schoolId,
				TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR,
				TYPE_CODES.ENTITY_TYPE.SCHOOL,
				userId,
			]),
			this.dataSource.query(FINDINGS_SQL, [id, IFCS_PARAMETER_KEYS.FINDING_PREFIX]),
			this.dataSource.query(OUTCOME_COURSE_BY_IFC_SQL, [id]),
		]);

		if (headerRows.length === 0) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result.viewFailed,
					errors: [ifcsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}

		const findingIds = findingRows.map((r: any) => Number(r.finding_id));
		const header = headerRows[0];
		const [findingOutcomeRows, findingActionRows, previousActions] = await Promise.all([
			findingIds.length
				? this.dataSource.query(FINDING_OUTCOMES_SQL, [findingIds])
				: Promise.resolve([]),
			findingIds.length
				? this.dataSource.query(FINDING_ACTIONS_SQL, [
						findingIds,
						IFCS_PARAMETER_KEYS.ACTION_PREFIX,
						TYPE_CODES.ACTION_COMPLETENESS.PENDING,
						TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED,
					])
				: Promise.resolve([]),
			this.loadPreviousActions(Number(header.course_id), Number(header.academic_period_id), id),
		]);

		return this.assembleViewResponse({
			header,
			findingRows,
			outcomeCourseRows,
			findingOutcomeRows,
			findingActionRows,
			previousActions,
		});
	}

	groupOutcomeRows(rows: any[]) {
		const programIndex = new Map<
			string,
			{ program_code: string; program_name: I18nText; commissions: Map<string, any> }
		>();
		for (const row of rows) {
			let pg = programIndex.get(row.program_code);
			if (!pg) {
				pg = {
					program_code: row.program_code,
					program_name: row.program_name,
					commissions: new Map(),
				};
				programIndex.set(row.program_code, pg);
			}
			let cm = pg.commissions.get(row.commission_code);
			if (!cm) {
				cm = {
					commission_code: row.commission_code,
					commission_name: row.commission_name,
					outcomes: [] as any[],
				};
				pg.commissions.set(row.commission_code, cm);
			}
			cm.outcomes.push({
				outcome_code: row.outcome_code,
				outcome_name: row.outcome_name,
				outcome_description: row.outcome_description,
			});
		}
		return Array.from(programIndex.values()).map((pg) => ({
			program_code: pg.program_code,
			program_name: pg.program_name,
			commissions: Array.from(pg.commissions.values()),
		}));
	}

	async loadPreviousActions(courseId: number, activePeriodId: number, excludeIfcId: number | null) {
		const rows = await this.dataSource.query(PREVIOUS_ACTIONS_SQL, [
			courseId,
			activePeriodId,
			excludeIfcId,
			IFCS_PARAMETER_KEYS.ACTION_PREFIX,
			TYPE_CODES.ACTION_COMPLETENESS.PENDING,
			TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED,
			IFCS_PARAMETER_KEYS.FINDING_PREFIX,
		]);
		return rows.map((r: any) => ({
			id: Number(r.id),
			finding_action_id: Number(r.finding_action_id),
			finding: {
				id: Number(r.finding_id),
				code: r.finding_code,
			},
			code: r.code,
			correlative: Number(r.correlative),
			description: r.description,
			evidences: r.evidences,
			completeness: {
				code: r.completeness_code,
				name: r.completeness_name,
				color: r.completeness_color ?? null,
			},
			source: r.source as 'plan' | 'direct' | 'both',
		}));
	}

	private assembleViewResponse(input: {
		header: any;
		findingRows: any[];
		outcomeCourseRows: any[];
		findingOutcomeRows: any[];
		findingActionRows: any[];
		previousActions: any[];
	}) {
		const {
			header,
			findingRows,
			outcomeCourseRows,
			findingOutcomeRows,
			findingActionRows,
			previousActions,
		} = input;

		const ifc = {
			id: Number(header.ifc_id),
			information: header.information,
			extra: header.extra,
			created_at: header.ifc_created_at,
			academic_period_code: header.academic_period_code,
			program_label: header.program_label,
			area_label: header.area_label,
			subarea_label: header.subarea_label,
			course_code: header.course_code ?? null,
			course_name: header.course_name,
			course_learning_outcome: header.course_learning_outcome,
			coordinator: {
				user_id: header.coordinator_user_id === null ? null : Number(header.coordinator_user_id),
				code: header.coordinator_code ?? null,
				name: header.coordinator_name,
			},
			status: header.status_code
				? {
						code: header.status_code,
						name: header.status_name,
						color: header.status_color ?? null,
						at: header.status_at,
						comment: header.status_comment ?? null,
						by: header.status_by_name ?? null,
					}
				: null,
			requester_in_chain: Boolean(header.requester_in_chain),
		};

		const outcomesByFinding = new Map<number, any[]>();
		for (const row of findingOutcomeRows) {
			const fid = Number(row.finding_id);
			const arr = outcomesByFinding.get(fid) ?? [];
			arr.push({
				outcome_code: row.outcome_code,
				outcome_name: row.outcome_name,
				outcome_description: row.outcome_description,
				commission: { code: row.commission_code, name: row.commission_name },
			});
			outcomesByFinding.set(fid, arr);
		}

		const actionsByFinding = new Map<number, any[]>();
		for (const row of findingActionRows) {
			const fid = Number(row.finding_id);
			const arr = actionsByFinding.get(fid) ?? [];
			arr.push({
				id: Number(row.action_id),
				code: row.action_code,
				description: row.action_description,
				correlative: row.action_correlative,
				completeness: {
					code: row.completeness_code,
					name: row.completeness_name,
					color: row.completeness_color ?? null,
				},
			});
			actionsByFinding.set(fid, arr);
		}

		const findings = findingRows.map((row: any) => {
			const fid = Number(row.finding_id);
			return {
				id: fid,
				code: row.finding_code,
				description: row.finding_description,
				correlative: row.finding_correlative,
				is_automatic: row.is_automatic,
				criticality: {
					code: row.criticality_code,
					name: row.criticality_name,
					color: row.criticality_color ?? null,
				},
				outcomes: outcomesByFinding.get(fid) ?? [],
				actions: actionsByFinding.get(fid) ?? [],
			};
		});

		return {
			ifc,
			outcome_course_result: this.groupOutcomeRows(outcomeCourseRows),
			findings,
			previous_actions: previousActions,
		};
	}
}
