import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { I18nText } from 'src/shared/types/i18n';
import { TYPE_CODES, TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';
import { IfcEntity } from '../model/ifcs.entity';
import { REPORT_CODES_SQL, STATUS_REPORT_SQL } from './ifc-report.sql';
import {
	LIST_SQL,
	HEADER_SQL,
	FINDINGS_SQL,
	FINDING_OUTCOMES_SQL,
	FINDING_ACTIONS_SQL,
	OUTCOME_COURSE_BY_IFC_SQL,
	OUTCOME_COURSE_BY_CHART_SQL,
	PREVIOUS_ACTIONS_SQL,
	PREFILL_HEADER_SQL,
	TRANSITION_CONTEXT_SQL,
	INSERT_STATUS_SQL,
	CHART_RESOLUTION_SQL,
	PROGRAM_BY_COURSE_PERIOD_SQL,
	STATUS_HISTORY_SQL,
} from '../api/ifcs.sql';

export interface IfcStatusReportRow {
	courseName: string;
	areaLabel: string;
	programLabel: string;
	coordinatorName: string | null;
	coordinatorEmail: string | null;
	coordinatorCode: string | null;
	statusCode: string | null;
}

export interface IfcReportCodes {
	schoolCode: string | null;
	programCodes: string[];
}

export interface IfcStatusType {
	code: string;
	name: { es?: string; en?: string };
}

export interface IfcListRow {
	chartId: number;
	courseCode: string;
	courseName: I18nText;
	programLabel: I18nText;
	coordinatorUserId: number | null;
	coordinatorName: string | null;
	ifc: Record<string, unknown> | null;
}

export interface IfcViewHeaderRow {
	ifcId: number;
	courseId: number;
	academicPeriodId: number;
	information: I18nText;
	extra: Record<string, unknown>;
	ifcCreatedAt: string;
	academicPeriodCode: string;
	programLabel: I18nText;
	areaLabel: I18nText;
	subareaLabel: I18nText;
	courseCode: string | null;
	courseName: I18nText;
	courseLearningOutcome: I18nText;
	coordinatorUserId: number | null;
	coordinatorCode: string | null;
	coordinatorName: string | null;
	statusCode: string | null;
	statusName: I18nText | null;
	statusColor: string | null;
	statusAt: string | null;
	statusComment: I18nText | null;
	statusByName: string | null;
	requesterInChain: boolean;
	requesterHasHigherLevel: boolean;
}

export interface IfcFindingRow {
	findingId: number;
	findingCorrelative: number;
	findingDescription: I18nText;
	isAutomatic: boolean;
	findingCode: string;
	criticalityCode: string;
	criticalityName: I18nText;
	criticalityColor: string | null;
}

export interface IfcFindingOutcomeRow {
	findingId: number;
	outcomeCode: string;
	outcomeName: I18nText;
	outcomeDescription: I18nText;
	commissionCode: string;
	commissionName: I18nText;
}

export interface IfcFindingActionRow {
	findingId: number;
	actionId: number;
	actionCorrelative: number;
	actionDescription: I18nText;
	actionCode: string;
	completenessCode: string;
	completenessName: I18nText;
	completenessColor: string | null;
}

export interface IfcOutcomeCourseRow {
	programCode: string;
	programName: I18nText;
	commissionCode: string;
	commissionName: I18nText;
	outcomeCode: string;
	outcomeName: I18nText;
	outcomeDescription: I18nText;
}

export interface IfcPreviousActionRow {
	id: number;
	findingActionId: number;
	findingId: number;
	findingCode: string;
	correlative: number;
	description: I18nText;
	evidences: I18nText | null;
	completenessCode: string;
	completenessName: I18nText;
	completenessColor: string | null;
	code: string;
	source: 'plan' | 'direct' | 'both';
}

export interface IfcPrefillHeaderRow {
	academicPeriodCode: string;
	areaLabel: I18nText;
	subareaLabel: I18nText;
	courseId: number;
	courseName: I18nText;
	courseLearningOutcome: I18nText;
	coordinatorUserId: number | null;
	coordinatorCode: string | null;
	coordinatorName: string | null;
	requesterInChain: boolean;
	requesterHasHigherLevel: boolean;
}

export interface IfcTransitionContextRow {
	courseChartId: number | null;
	requesterStaffId: number | null;
	currentStatusCode: string | null;
}

export interface IfcStatusInsertResult {
	code: string;
	name: I18nText;
	at: string;
	comment: I18nText | null;
	by: string | null;
}

export interface IfcStatusHistoryRow {
	statusCode: string;
	statusName: I18nText;
	statusColor: string | null;
	registerAt: string;
	comment: I18nText | null;
	staffName: string | null;
}

export interface IfcChartResolutionRow {
	courseId: number;
	programId: number | null;
	requesterStaffId: number | null;
}

export interface IfcCoursePeriodRow {
	courseId: number;
	academicPeriodId: number;
}

export interface IfcProgramRow {
	programId: number | null;
}

export interface IfcCriticalityRow {
	id: number;
	code: string;
}

export class IfcRepository extends BaseRepository<IfcEntity> {
	constructor(
		@InjectRepository(IfcEntity)
		repository: Repository<IfcEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	private runner(manager?: EntityManager): Pick<DataSource, 'query'> {
		return manager ?? this.dataSource;
	}

	async transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(work);
	}

	async getReportCodes(chartIds: number[], schoolId: number): Promise<IfcReportCodes | null> {
		const [row] = await this.dataSource.query(REPORT_CODES_SQL, [
			chartIds,
			schoolId,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
		]);
		return row ?? null;
	}

	async getStatusTypes(): Promise<IfcStatusType[]> {
		return this.dataSource.query(
			`SELECT t.code, t.name
			 FROM core.types t
			 INNER JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1`,
			[TYPE_GROUP_CODES.IFC_STATUS],
		);
	}

	async getStatusReportRows(
		chartIds: number[],
		schoolId: number,
		academicPeriodId: number,
		language: 'es' | 'en',
	): Promise<IfcStatusReportRow[]> {
		return this.dataSource.query(STATUS_REPORT_SQL, [
			chartIds,
			academicPeriodId,
			schoolId,
			TYPE_CODES.ENTITY_TYPE.COURSE,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
			language,
		]);
	}

	async findIfcListRows(chartIds: number[], academicPeriodId: number): Promise<IfcListRow[]> {
		return this.dataSource.query(LIST_SQL, [
			chartIds,
			academicPeriodId,
			TYPE_CODES.ENTITY_TYPE.COURSE,
			TYPE_CODES.ENTITY_TYPE.PROGRAM,
		]);
	}

	async findViewHeaderRows(
		ifcId: number,
		schoolId: number,
		userId: number,
	): Promise<IfcViewHeaderRow[]> {
		return this.dataSource.query(HEADER_SQL, [
			ifcId,
			schoolId,
			TYPE_CODES.ENTITY_TYPE.COURSE,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
			userId,
			TYPE_CODES.ENTITY_TYPE.PROGRAM,
		]);
	}

	async findFindingRows(ifcId: number, findingPrefixKey: string): Promise<IfcFindingRow[]> {
		return this.dataSource.query(FINDINGS_SQL, [ifcId, findingPrefixKey]);
	}

	async findOutcomeCourseRowsByIfc(ifcId: number): Promise<IfcOutcomeCourseRow[]> {
		return this.dataSource.query(OUTCOME_COURSE_BY_IFC_SQL, [ifcId]);
	}

	async findOutcomeCourseRowsByChart(chartId: number): Promise<IfcOutcomeCourseRow[]> {
		return this.dataSource.query(OUTCOME_COURSE_BY_CHART_SQL, [chartId]);
	}

	async findFindingOutcomeRows(findingIds: number[]): Promise<IfcFindingOutcomeRow[]> {
		return this.dataSource.query(FINDING_OUTCOMES_SQL, [findingIds]);
	}

	async findFindingActionRows(
		findingIds: number[],
		actionPrefixKey: string,
		pendingCode: string,
		implementedCode: string,
	): Promise<IfcFindingActionRow[]> {
		return this.dataSource.query(FINDING_ACTIONS_SQL, [
			findingIds,
			actionPrefixKey,
			pendingCode,
			implementedCode,
		]);
	}

	async findPreviousActionRows(
		courseId: number,
		activePeriodId: number,
		excludeIfcId: number | null,
		actionPrefixKey: string,
		pendingCode: string,
		implementedCode: string,
		findingPrefixKey: string,
		manager?: EntityManager,
	): Promise<IfcPreviousActionRow[]> {
		return this.runner(manager).query(PREVIOUS_ACTIONS_SQL, [
			courseId,
			activePeriodId,
			excludeIfcId,
			actionPrefixKey,
			pendingCode,
			implementedCode,
			findingPrefixKey,
		]);
	}

	async findPrefillHeaderRows(
		chartId: number,
		academicPeriodId: number,
		schoolId: number,
		userId: number,
	): Promise<IfcPrefillHeaderRow[]> {
		return this.dataSource.query(PREFILL_HEADER_SQL, [
			chartId,
			academicPeriodId,
			schoolId,
			TYPE_CODES.ENTITY_TYPE.COURSE,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
			userId,
		]);
	}

	async resolveCurrentStatusCode(
		chartId: number,
		periodId: number,
		fallbackStatusCode: string,
	): Promise<string | null> {
		const rows = await this.dataSource.query(RESOLVE_CURRENT_STATUS_SQL, [
			chartId,
			periodId,
			fallbackStatusCode,
		]);
		return rows[0]?.code ?? null;
	}

	async lockIfc(ifcId: number, manager: EntityManager): Promise<{ id: number }[]> {
		return manager.query(`SELECT id FROM evidence.ifcs WHERE id = $1 FOR UPDATE`, [ifcId]);
	}

	async findIfcPeriodId(ifcId: number, manager?: EntityManager): Promise<number | undefined> {
		const rows: { academicPeriodId: number }[] = await this.runner(manager).query(
			`SELECT academic_period_id AS "academicPeriodId" FROM evidence.ifcs WHERE id = $1 LIMIT 1`,
			[ifcId],
		);
		return rows[0]?.academicPeriodId === undefined ? undefined : Number(rows[0].academicPeriodId);
	}

	async findCoursePeriod(
		ifcId: number,
		manager?: EntityManager,
	): Promise<IfcCoursePeriodRow | undefined> {
		const rows: IfcCoursePeriodRow[] = await this.runner(manager).query(
			`SELECT course_id AS "courseId", academic_period_id AS "academicPeriodId" FROM evidence.ifcs WHERE id = $1`,
			[ifcId],
		);
		return rows[0];
	}

	async findTransitionContextRows(
		ifcId: number,
		schoolId: number,
		userId: number,
		manager?: EntityManager,
	): Promise<IfcTransitionContextRow[]> {
		return this.runner(manager).query(TRANSITION_CONTEXT_SQL, [
			ifcId,
			schoolId,
			userId,
			TYPE_CODES.ENTITY_TYPE.COURSE,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
		]);
	}

	async findStatusHistoryRows(ifcId: number): Promise<IfcStatusHistoryRow[]> {
		return this.dataSource.query(STATUS_HISTORY_SQL, [ifcId]);
	}

	async insertStatus(
		ifcId: number,
		newStatusCode: string,
		requesterStaffId: number | null,
		comment: I18nText | null,
		manager?: EntityManager,
	): Promise<IfcStatusInsertResult> {
		const rows: IfcStatusInsertResult[] = await this.runner(manager).query(INSERT_STATUS_SQL, [
			ifcId,
			newStatusCode,
			requesterStaffId,
			comment ? JSON.stringify(comment) : null,
		]);
		return rows[0];
	}

	async resolveChart(
		chartId: number,
		academicPeriodId: number,
		schoolId: number,
		userId: number,
		manager?: EntityManager,
	): Promise<IfcChartResolutionRow[]> {
		return this.runner(manager).query(CHART_RESOLUTION_SQL, [
			chartId,
			academicPeriodId,
			schoolId,
			TYPE_CODES.ENTITY_TYPE.COURSE,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
			userId,
			TYPE_CODES.ENTITY_TYPE.PROGRAM,
		]);
	}

	async findProgramByCoursePeriod(
		courseId: number,
		periodId: number,
		manager?: EntityManager,
	): Promise<IfcProgramRow[]> {
		return this.runner(manager).query(PROGRAM_BY_COURSE_PERIOD_SQL, [
			courseId,
			periodId,
			TYPE_CODES.ENTITY_TYPE.COURSE,
			TYPE_CODES.ENTITY_TYPE.PROGRAM,
		]);
	}

	async insertIfc(
		courseId: number,
		academicPeriodId: number,
		information: Record<string, I18nText>,
		manager: EntityManager,
	): Promise<number> {
		const rows: { id: number }[] = await manager.query(
			`INSERT INTO evidence.ifcs (course_id, academic_period_id, information, extra, is_active) VALUES ($1, $2, $3::jsonb, '{}'::jsonb, true) RETURNING id`,
			[courseId, academicPeriodId, JSON.stringify(information)],
		);
		return Number(rows[0].id);
	}

	async updateIfcInformation(
		ifcId: number,
		information: Record<string, I18nText>,
		manager: EntityManager,
	): Promise<void> {
		await manager.query(
			`UPDATE evidence.ifcs SET information = $1::jsonb, updated_at = NOW() WHERE id = $2`,
			[JSON.stringify(information), ifcId],
		);
	}

	async findIfcInstrumentId(
		instrumentCode: string,
		manager: EntityManager,
	): Promise<number | undefined> {
		const rows: { id: number }[] = await manager.query(
			`SELECT id::int AS id FROM evidence.instruments WHERE code = $1 AND is_active = true LIMIT 1`,
			[instrumentCode],
		);
		return rows[0]?.id;
	}

	async findCriticalityTypes(
		criticalityCodes: string[],
		manager: EntityManager,
	): Promise<IfcCriticalityRow[]> {
		return manager.query(
			`SELECT id::int AS id, code FROM core.types WHERE code = ANY($1::text[])`,
			[criticalityCodes],
		);
	}

	async maxFindingCorrelative(
		instrumentId: number,
		courseId: number,
		manager: EntityManager,
	): Promise<number> {
		const rows: { c: number }[] = await manager.query(
			`SELECT COALESCE(MAX(correlative), 0)::int AS c
			 FROM improvement.findings
			 WHERE instrument_id = $1
			   AND ((course_id IS NULL AND $2::int IS NULL) OR course_id = $2)`,
			[instrumentId, courseId],
		);
		return Number(rows[0]?.c ?? 0);
	}

	async insertFinding(
		input: {
			criticalityTypeId: number;
			instrumentId: number;
			requesterStaffId: number;
			correlative: number;
			description: I18nText;
			courseId: number;
			periodId: number;
		},
		manager: EntityManager,
	): Promise<number> {
		const rows: { id: number }[] = await manager.query(
			`INSERT INTO improvement.findings (criticality_type_id, instrument_id, staff_id, correlative, description, course_id, academic_period_id, campus_id, is_automatic, is_active)
			 VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NULL, false, true)
			 RETURNING id`,
			[
				input.criticalityTypeId,
				input.instrumentId,
				input.requesterStaffId,
				input.correlative,
				JSON.stringify(input.description),
				input.courseId,
				input.periodId,
			],
		);
		return Number(rows[0].id);
	}

	async linkIfcFinding(ifcId: number, findingId: number, manager: EntityManager): Promise<void> {
		await manager.query(
			`INSERT INTO ifc.ifc_findings (ifc_id, finding_id, is_active)
			 SELECT $1, $2, true
			 WHERE NOT EXISTS (SELECT 1 FROM ifc.ifc_findings WHERE ifc_id = $1 AND finding_id = $2)`,
			[ifcId, findingId],
		);
	}

	async updateFinding(
		findingId: number,
		description: I18nText,
		criticalityTypeId: number,
		manager: EntityManager,
	): Promise<void> {
		await manager.query(
			`UPDATE improvement.findings SET description = $1::jsonb, criticality_type_id = $2, updated_at = NOW() WHERE id = $3`,
			[JSON.stringify(description), criticalityTypeId, findingId],
		);
	}

	async maxActionCorrelative(
		instrumentId: number,
		courseId: number,
		manager: EntityManager,
	): Promise<number> {
		const rows: { c: number }[] = await manager.query(
			`SELECT COALESCE(MAX(a.correlative), 0)::int AS c
			 FROM improvement.actions a
			 JOIN improvement.finding_actions fa ON fa.action_id = a.id
			 JOIN improvement.findings f         ON f.id          = fa.finding_id
			 WHERE f.instrument_id = $1
			   AND ((f.course_id IS NULL AND $2::int IS NULL) OR f.course_id = $2)`,
			[instrumentId, courseId],
		);
		return Number(rows[0]?.c ?? 0);
	}

	async insertAction(
		input: {
			description: I18nText;
			correlative: number;
			programId: number | null;
			periodId: number;
		},
		manager: EntityManager,
	): Promise<number> {
		const rows: { id: number }[] = await manager.query(
			`INSERT INTO improvement.actions (description, correlative, program_id, academic_period_id, is_active)
			 VALUES ($1::jsonb, $2, $3, $4, true)
			 RETURNING id`,
			[JSON.stringify(input.description), input.correlative, input.programId, input.periodId],
		);
		return Number(rows[0].id);
	}

	async linkFindingAction(
		findingId: number,
		actionId: number,
		manager: EntityManager,
	): Promise<void> {
		await manager.query(
			`INSERT INTO improvement.finding_actions (finding_id, action_id, in_plan_required, evidences, is_active)
			 VALUES ($1, $2, false, NULL, true)`,
			[findingId, actionId],
		);
	}

	async updateAction(
		actionId: number,
		description: I18nText,
		manager: EntityManager,
	): Promise<void> {
		await manager.query(
			`UPDATE improvement.actions SET description = $1::jsonb, updated_at = NOW() WHERE id = $2`,
			[JSON.stringify(description), actionId],
		);
	}

	async relinkFindingAction(
		findingId: number,
		actionId: number,
		manager: EntityManager,
	): Promise<void> {
		await manager.query(
			`UPDATE improvement.finding_actions SET finding_id = $1 WHERE action_id = $2 AND finding_id <> $1`,
			[findingId, actionId],
		);
	}

	async updateFindingActionEvidences(
		findingActionId: number,
		evidences: I18nText | null,
		manager: EntityManager,
	): Promise<void> {
		await manager.query(
			`UPDATE improvement.finding_actions SET evidences = $1::jsonb, updated_at = NOW() WHERE id = $2`,
			[evidences === null ? null : JSON.stringify(evidences), findingActionId],
		);
	}

	async deleteAction(actionId: number, manager: EntityManager): Promise<void> {
		await manager.query(`DELETE FROM improvement.finding_actions WHERE action_id = $1`, [actionId]);
		await manager.query(`DELETE FROM improvement.actions WHERE id = $1`, [actionId]);
	}

	async deleteFinding(findingId: number, manager: EntityManager): Promise<void> {
		await manager.query(`DELETE FROM improvement.finding_outcomes WHERE finding_id = $1`, [
			findingId,
		]);
		await manager.query(`DELETE FROM improvement.finding_actions WHERE finding_id = $1`, [
			findingId,
		]);
		await manager.query(`DELETE FROM ifc.ifc_findings WHERE finding_id = $1`, [findingId]);
		await manager.query(`DELETE FROM improvement.findings WHERE id = $1`, [findingId]);
	}
}

const RESOLVE_CURRENT_STATUS_SQL = `
SELECT COALESCE(
	(SELECT t.code FROM ifc.statuses s
	   JOIN core.types t ON t.id = s.status_type_id
	   JOIN evidence.ifcs i ON i.id = s.ifc_id
	   JOIN organization.charts c ON c.entity_code = i.course_id AND c.academic_period_id = i.academic_period_id
	   WHERE c.id = $1 AND i.academic_period_id = $2
	   ORDER BY s.created_at DESC LIMIT 1),
	$3
) AS code
`;
