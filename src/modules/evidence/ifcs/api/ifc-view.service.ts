import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { I18nText } from 'src/shared/types/i18n';
import { ifcsValidationStrings } from '../config/strings/ifcs.validation';
import { IFCS_PARAMETER_KEYS } from './ifcs.constants';
import {
	IfcRepository,
	IfcViewHeaderRow,
	IfcFindingRow,
	IfcFindingOutcomeRow,
	IfcFindingActionRow,
	IfcOutcomeCourseRow,
} from '../core/ifcs.repository';

export interface IfcViewOutcome {
	outcomeCode: string;
	outcomeName: I18nText;
	outcomeDescription: I18nText;
}

export interface IfcViewCommissionGroup {
	commissionCode: string;
	commissionName: I18nText;
	outcomes: IfcViewOutcome[];
}

export interface IfcViewProgramGroup {
	programCode: string;
	programName: I18nText;
	commissions: IfcViewCommissionGroup[];
}

export interface IfcViewFindingOutcome extends IfcViewOutcome {
	commission: { code: string; name: I18nText };
}

export interface IfcViewFindingAction {
	id: number;
	code: string;
	description: I18nText;
	correlative: number;
	completeness: { code: string; name: I18nText; color: string | null };
}

export interface IfcViewPreviousAction {
	id: number;
	findingActionId: number;
	finding: { id: number; code: string };
	code: string;
	correlative: number;
	description: I18nText;
	evidences: I18nText | null;
	completeness: { code: string; name: I18nText; color: string | null };
	source: 'plan' | 'direct' | 'both';
}

@Injectable()
export class IfcViewService {
	private readonly logger = new Logger(IfcViewService.name);

	constructor(private readonly repository: IfcRepository) {}

	async getView(id: number, userId: number, schoolId: number) {
		const errors: string[] = [];

		const [headerResult, findingsResult, outcomeCourseResult] = await Promise.allSettled([
			this.repository.findViewHeaderRows(id, schoolId, userId),
			this.repository.findFindingRows(id, IFCS_PARAMETER_KEYS.FINDING_PREFIX),
			this.repository.findOutcomeCourseRowsByIfc(id),
		]);

		if (headerResult.status === 'rejected') throw headerResult.reason;
		const headerRows = headerResult.value;

		if (headerRows.length === 0) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result.viewFailed,
					errors: [ifcsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}

		const findingRows = findingsResult.status === 'fulfilled' ? findingsResult.value : [];
		if (findingsResult.status === 'rejected') {
			this.logger.error(
				`getView(${id}) FINDINGS_SQL failed: ${(findingsResult.reason as Error).message}`,
			);
			errors.push('findings');
		}

		const outcomeCourseRows =
			outcomeCourseResult.status === 'fulfilled' ? outcomeCourseResult.value : [];
		if (outcomeCourseResult.status === 'rejected') {
			this.logger.error(
				`getView(${id}) OUTCOME_COURSE_SQL failed: ${(outcomeCourseResult.reason as Error).message}`,
			);
			errors.push('outcome_course');
		}

		const findingIds = findingRows.map((r) => Number(r.findingId));
		const header = headerRows[0];

		const [findingOutcomeResult, findingActionResult, previousActionsResult] =
			await Promise.allSettled([
				findingIds.length
					? this.repository.findFindingOutcomeRows(findingIds)
					: Promise.resolve<IfcFindingOutcomeRow[]>([]),
				findingIds.length
					? this.repository.findFindingActionRows(
							findingIds,
							IFCS_PARAMETER_KEYS.ACTION_PREFIX,
							TYPE_CODES.ACTION_COMPLETENESS.PENDING,
							TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED,
						)
					: Promise.resolve<IfcFindingActionRow[]>([]),
				this.loadPreviousActions(Number(header.courseId), Number(header.academicPeriodId), id),
			]);

		const findingOutcomeRows =
			findingOutcomeResult.status === 'fulfilled' ? findingOutcomeResult.value : [];
		if (findingOutcomeResult.status === 'rejected') {
			this.logger.error(
				`getView(${id}) FINDING_OUTCOMES_SQL failed: ${(findingOutcomeResult.reason as Error).message}`,
			);
			errors.push('finding_outcomes');
		}

		const findingActionRows =
			findingActionResult.status === 'fulfilled' ? findingActionResult.value : [];
		if (findingActionResult.status === 'rejected') {
			this.logger.error(
				`getView(${id}) FINDING_ACTIONS_SQL failed: ${(findingActionResult.reason as Error).message}`,
			);
			errors.push('finding_actions');
		}

		const previousActions =
			previousActionsResult.status === 'fulfilled' ? previousActionsResult.value : [];
		if (previousActionsResult.status === 'rejected') {
			this.logger.error(
				`getView(${id}) PREVIOUS_ACTIONS_SQL failed: ${(previousActionsResult.reason as Error).message}`,
			);
			errors.push('previous_actions');
		}

		return {
			...this.assembleViewResponse({
				header,
				findingRows,
				outcomeCourseRows,
				findingOutcomeRows,
				findingActionRows,
				previousActions,
			}),
			...(errors.length > 0 && { errors }),
		};
	}

	groupOutcomeRows(rows: IfcOutcomeCourseRow[]): IfcViewProgramGroup[] {
		const programIndex = new Map<
			string,
			{
				programCode: string;
				programName: I18nText;
				commissions: Map<string, IfcViewCommissionGroup>;
			}
		>();
		for (const row of rows) {
			let pg = programIndex.get(row.programCode);
			if (!pg) {
				pg = {
					programCode: row.programCode,
					programName: row.programName,
					commissions: new Map(),
				};
				programIndex.set(row.programCode, pg);
			}
			let cm = pg.commissions.get(row.commissionCode);
			if (!cm) {
				cm = {
					commissionCode: row.commissionCode,
					commissionName: row.commissionName,
					outcomes: [],
				};
				pg.commissions.set(row.commissionCode, cm);
			}
			cm.outcomes.push({
				outcomeCode: row.outcomeCode,
				outcomeName: row.outcomeName,
				outcomeDescription: row.outcomeDescription,
			});
		}
		return Array.from(programIndex.values()).map((pg) => ({
			programCode: pg.programCode,
			programName: pg.programName,
			commissions: Array.from(pg.commissions.values()),
		}));
	}

	async loadPreviousActions(
		courseId: number,
		activePeriodId: number,
		excludeIfcId: number | null,
	): Promise<IfcViewPreviousAction[]> {
		const rows = await this.repository.findPreviousActionRows(
			courseId,
			activePeriodId,
			excludeIfcId,
			IFCS_PARAMETER_KEYS.ACTION_PREFIX,
			TYPE_CODES.ACTION_COMPLETENESS.PENDING,
			TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED,
			IFCS_PARAMETER_KEYS.FINDING_PREFIX,
		);
		return rows.map((r) => ({
			id: Number(r.id),
			findingActionId: Number(r.findingActionId),
			finding: {
				id: Number(r.findingId),
				code: r.findingCode,
			},
			code: r.code,
			correlative: Number(r.correlative),
			description: r.description,
			evidences: r.evidences,
			completeness: {
				code: r.completenessCode,
				name: r.completenessName,
				color: r.completenessColor ?? null,
			},
			source: r.source as 'plan' | 'direct' | 'both',
		}));
	}

	private assembleViewResponse(input: {
		header: IfcViewHeaderRow;
		findingRows: IfcFindingRow[];
		outcomeCourseRows: IfcOutcomeCourseRow[];
		findingOutcomeRows: IfcFindingOutcomeRow[];
		findingActionRows: IfcFindingActionRow[];
		previousActions: IfcViewPreviousAction[];
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
			id: Number(header.ifcId),
			information: header.information,
			extra: header.extra,
			createdAt: header.ifcCreatedAt,
			academicPeriodCode: header.academicPeriodCode,
			programLabel: header.programLabel,
			areaLabel: header.areaLabel,
			subareaLabel: header.subareaLabel,
			courseCode: header.courseCode ?? null,
			courseName: header.courseName,
			courseLearningOutcome: header.courseLearningOutcome,
			coordinator: {
				userId: header.coordinatorUserId === null ? null : Number(header.coordinatorUserId),
				code: header.coordinatorCode ?? null,
				name: header.coordinatorName,
			},
			status: header.statusCode
				? {
						code: header.statusCode,
						name: header.statusName,
						color: header.statusColor ?? null,
						at: header.statusAt,
						comment: header.statusComment ?? null,
						by: header.statusByName ?? null,
					}
				: null,
			requesterInChain: Boolean(header.requesterInChain),
			requesterHasHigherLevel: Boolean(header.requesterHasHigherLevel),
		};

		const outcomesByFinding = new Map<number, IfcViewFindingOutcome[]>();
		for (const row of findingOutcomeRows) {
			const fid = Number(row.findingId);
			const arr = outcomesByFinding.get(fid) ?? [];
			arr.push({
				outcomeCode: row.outcomeCode,
				outcomeName: row.outcomeName,
				outcomeDescription: row.outcomeDescription,
				commission: { code: row.commissionCode, name: row.commissionName },
			});
			outcomesByFinding.set(fid, arr);
		}

		const actionsByFinding = new Map<number, IfcViewFindingAction[]>();
		for (const row of findingActionRows) {
			const fid = Number(row.findingId);
			const arr = actionsByFinding.get(fid) ?? [];
			arr.push({
				id: Number(row.actionId),
				code: row.actionCode,
				description: row.actionDescription,
				correlative: row.actionCorrelative,
				completeness: {
					code: row.completenessCode,
					name: row.completenessName,
					color: row.completenessColor ?? null,
				},
			});
			actionsByFinding.set(fid, arr);
		}

		const findings = findingRows.map((row) => {
			const fid = Number(row.findingId);
			return {
				id: fid,
				code: row.findingCode,
				description: row.findingDescription,
				correlative: row.findingCorrelative,
				isAutomatic: row.isAutomatic,
				criticality: {
					code: row.criticalityCode,
					name: row.criticalityName,
					color: row.criticalityColor ?? null,
				},
				outcomes: outcomesByFinding.get(fid) ?? [],
				actions: actionsByFinding.get(fid) ?? [],
			};
		});

		return {
			ifc,
			outcomeCourseResult: this.groupOutcomeRows(outcomeCourseRows),
			findings,
			previousActions: previousActions,
		};
	}
}
