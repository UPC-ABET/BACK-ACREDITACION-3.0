import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { IfcFindingEntity } from '../model/ifc-findings.entity';
import { I18nText } from 'src/shared/types/i18n';
import {
	FINDING_ACTIONS_SQL,
	FINDING_HEADER_SQL,
	FINDING_IN_SCHOOL_SQL,
	LIST_FINDINGS_SQL,
} from './ifc-findings.sql';

export interface FindingListRow {
	id: number;
	ifcId: number;
	courseId: number;
	criticalityCode: string;
	criticalityName: I18nText;
	criticalityColor: string | null;
	criticalityOrder: number;
	findingCode: string;
	academicPeriodCode: string;
	description: I18nText;
}

export interface FindingHeaderRow {
	id: number;
	findingCode: string;
	academicPeriodCode: string;
	description: I18nText;
	criticalityCode: string;
	criticalityName: I18nText;
	criticalityColor: string | null;
}

export interface FindingActionRow {
	id: number;
	actionCode: string;
	description: I18nText;
	completenessCode: string;
	completenessName: I18nText;
	completenessColor: string | null;
}

export interface DeletedFindingActionRow {
	actionId: number;
}

export class IfcFindingRepository extends BaseRepository<IfcFindingEntity> {
	constructor(
		@InjectRepository(IfcFindingEntity)
		repository: Repository<IfcFindingEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	runInTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(work);
	}

	async listFindings(
		chartIds: number[],
		academicPeriodId: number,
		schoolId: number,
		findingPrefixKey: string,
		schoolEntityTypeCode: string,
	): Promise<FindingListRow[]> {
		return this.dataSource.query(LIST_FINDINGS_SQL, [
			chartIds,
			academicPeriodId,
			schoolId,
			findingPrefixKey,
			schoolEntityTypeCode,
		]);
	}

	async getFindingHeader(
		findingId: number,
		schoolId: number,
		findingPrefixKey: string,
		schoolEntityTypeCode: string,
	): Promise<FindingHeaderRow[]> {
		return this.dataSource.query(FINDING_HEADER_SQL, [
			findingId,
			schoolId,
			findingPrefixKey,
			schoolEntityTypeCode,
		]);
	}

	async getFindingActions(
		findingId: number,
		actionPrefixKey: string,
		pendingCompletenessCode: string,
		implementedCompletenessCode: string,
	): Promise<FindingActionRow[]> {
		return this.dataSource.query(FINDING_ACTIONS_SQL, [
			findingId,
			actionPrefixKey,
			pendingCompletenessCode,
			implementedCompletenessCode,
		]);
	}

	async findRequesterStaffId(manager: EntityManager, userId: number): Promise<number | null> {
		const rows = (await manager.query(
			'SELECT id::int AS id FROM organization.staff WHERE user_id = $1 LIMIT 1',
			[userId],
		)) as Array<{ id: number }>;
		return rows[0]?.id ?? null;
	}

	async deleteFindingActions(manager: EntityManager, findingId: number): Promise<number[]> {
		const [deletedFindingActions] = (await manager.query(
			'DELETE FROM improvement.finding_actions WHERE finding_id = $1 RETURNING action_id AS "actionId"',
			[findingId],
		)) as [DeletedFindingActionRow[], number];
		return deletedFindingActions.map((r) => Number(r.actionId));
	}

	async deleteActionsByIds(manager: EntityManager, actionIds: number[]): Promise<void> {
		await manager.query('DELETE FROM improvement.actions WHERE id = ANY($1::int[])', [actionIds]);
	}

	async deleteFindingOutcomes(manager: EntityManager, findingId: number): Promise<void> {
		await manager.query('DELETE FROM improvement.finding_outcomes WHERE finding_id = $1', [
			findingId,
		]);
	}

	async deleteIfcFindings(manager: EntityManager, findingId: number): Promise<void> {
		await manager.query('DELETE FROM ifc.ifc_findings WHERE finding_id = $1', [findingId]);
	}

	async deleteFindingById(manager: EntityManager, findingId: number): Promise<void> {
		await manager.query('DELETE FROM improvement.findings WHERE id = $1', [findingId]);
	}

	async updateFindingDescription(
		manager: EntityManager,
		findingId: number,
		description: I18nText,
	): Promise<void> {
		await manager.query(
			`UPDATE improvement.findings
			 SET description = $1::jsonb, updated_at = NOW()
			 WHERE id = $2`,
			[JSON.stringify(description), findingId],
		);
	}

	async isFindingInSchool(
		manager: EntityManager,
		findingId: number,
		schoolEntityTypeCode: string,
		schoolId: number,
	): Promise<boolean> {
		const rows = await manager.query(FINDING_IN_SCHOOL_SQL, [
			findingId,
			schoolEntityTypeCode,
			schoolId,
		]);
		return rows.length > 0;
	}
}
