import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { IFCS_PARAMETER_KEYS } from 'src/modules/evidence/ifcs/api/ifcs.constants';
import type { I18nText } from 'src/shared/types/i18n';
import { NotificationConfigEntity } from 'src/modules/admin/ifc/notification-configs/model/notification-configs.entity';
import {
	LATEST_STATUS_COMMENT_SQL,
	LATEST_STATUS_USER_NAME_SQL,
	LOAD_CONFIG_SQL,
	RESOLVE_CONTEXT_SQL,
	RESOLVE_RECIPIENTS_SQL,
} from './notification-dispatcher.sql';

export interface ResolvedContextRow {
	courseChartId: number;
	schoolId: number;
	periodId: number;
	triggerTypeId: number;
	ifcStatusTypeId: number;
	ifcId: number | null;
	periodCode: string;
	courseName: I18nText | null;
	coordinatorName: string | null;
}

export interface LoadedConfigRow {
	id: number;
	emailTemplateId: number | null;
	subject: I18nText;
	body: I18nText;
	toChartEntityTypeIds: number[] | null;
	ccChartEntityTypeIds: number[] | null;
}

export interface RecipientRow {
	entityTypeId: number;
	staffId: number;
	staffEmail: string;
}

export interface NotificationVarRow {
	var: string;
	validStatusCodes: string[] | null;
}

interface NotificationVarsParamRow {
	value: Array<{ var: string; valid_status_codes: string[] | null }> | null;
}

export class NotificationDispatcherRepository extends BaseRepository<NotificationConfigEntity> {
	constructor(
		@InjectRepository(NotificationConfigEntity)
		repository: Repository<NotificationConfigEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async loadNotificationVars(): Promise<NotificationVarRow[]> {
		const rows: NotificationVarsParamRow[] = await this.dataSource.query(
			`SELECT value FROM core.parameters WHERE code = $1 LIMIT 1`,
			[IFCS_PARAMETER_KEYS.IFC_NOTIFICATION_VARS],
		);
		const raw = rows[0]?.value ?? [];
		// JSONB content stays snake_case in the DB; map to camelCase at the boundary.
		return raw.map((r) => ({ var: r.var, validStatusCodes: r.valid_status_codes }));
	}

	async resolveContext(params: {
		chartId: number;
		periodId: number;
		triggerCode: string;
		ifcStatusCode: string;
	}): Promise<ResolvedContextRow | null> {
		const rows: ResolvedContextRow[] = await this.dataSource.query(RESOLVE_CONTEXT_SQL, [
			params.chartId,
			params.periodId,
			params.triggerCode,
			TYPE_CODES.ENTITY_TYPE.COURSE,
			params.ifcStatusCode,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
		]);
		if (rows.length === 0 || rows[0].schoolId == null) return null;
		return rows[0];
	}

	async loadConfig(
		triggerTypeId: number,
		ifcStatusTypeId: number,
	): Promise<LoadedConfigRow | null> {
		const rows: LoadedConfigRow[] = await this.dataSource.query(LOAD_CONFIG_SQL, [
			triggerTypeId,
			ifcStatusTypeId,
		]);
		return rows[0] ?? null;
	}

	async resolveRecipients(courseChartId: number, entityTypeIds: number[]): Promise<RecipientRow[]> {
		return this.dataSource.query(RESOLVE_RECIPIENTS_SQL, [courseChartId, entityTypeIds]);
	}

	async lookupStatusCode(statusTypeId: number): Promise<string> {
		const rows: Array<{ code: string }> = await this.dataSource.query(
			`SELECT code FROM core.types WHERE id = $1 LIMIT 1`,
			[statusTypeId],
		);
		return rows[0]?.code ?? '';
	}

	async lookupUserName(userId: number): Promise<string> {
		const rows: Array<{ name: string }> = await this.dataSource.query(
			`SELECT first_name || ' ' || last_name AS "name" FROM organization.users WHERE id = $1 LIMIT 1`,
			[userId],
		);
		return rows[0]?.name ?? '';
	}

	async lookupLatestStatusUserName(ifcId: number, statusCode: string): Promise<string> {
		const rows: Array<{ name: string }> = await this.dataSource.query(LATEST_STATUS_USER_NAME_SQL, [
			ifcId,
			statusCode,
		]);
		return rows[0]?.name ?? '';
	}

	async lookupLatestStatusComment(
		ifcId: number,
		statusCode: string,
	): Promise<string | I18nText | null> {
		const rows: Array<{ comment: string | I18nText | null }> = await this.dataSource.query(
			LATEST_STATUS_COMMENT_SQL,
			[ifcId, statusCode],
		);
		return rows[0]?.comment ?? null;
	}

	async lookupTypeIdByCode(code: string): Promise<number | null> {
		const rows: Array<{ id: number }> =
			(await this.dataSource.query(
				`SELECT id::int AS "id" FROM core.types WHERE code = $1 LIMIT 1`,
				[code],
			)) ?? [];
		return rows[0]?.id ?? null;
	}
}
