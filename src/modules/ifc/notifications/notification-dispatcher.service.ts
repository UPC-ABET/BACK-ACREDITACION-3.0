import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { MailService } from 'src/modules/mail/mail.service';
import { NotificationLogService } from 'src/modules/ifc/notification-log/api/notification-log.service';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { IFCS_PARAMETER_KEYS } from 'src/modules/evidence/ifcs/api/ifcs.constants';
import type { I18nText } from 'src/shared/types/i18n';

export type DispatchInput = {
	chartId: number;
	periodId: number;
	triggerCode: string;
	ifcStatusCode: string;
	notifierUserId: number | null;
};

export type DispatchReason =
	| 'no_course_chart'
	| 'no_config'
	| 'no_recipients'
	| 'send_failed'
	| null;

export type DispatchResult = {
	sent: boolean;
	recipients_count: number;
	cc_count: number;
	reason: DispatchReason;
};

interface ResolvedContext {
	course_chart_id: number;
	school_id: number;
	period_id: number;
	trigger_type_id: number;
	ifc_status_type_id: number;
	ifc_id: number | null;
	period_code: string;
	course_name: I18nText | null;
	coordinator_name: string | null;
}

interface LoadedConfig {
	id: number;
	title: I18nText;
	body: I18nText;
	to_chart_level_type_ids: number[] | null;
	cc_chart_level_type_ids: number[] | null;
}

interface NotificationVar {
	var: string;
	valid_status_codes: string[] | null;
}

@Injectable()
export class NotificationDispatcherService {
	private readonly logger = new Logger(NotificationDispatcherService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly mailService: MailService,
		private readonly configService: ConfigService,
		private readonly notificationLogService: NotificationLogService,
	) {}

	async loadNotificationVars(): Promise<NotificationVar[]> {
		const paramRow = await this.dataSource.query(
			`SELECT value FROM core.parameters WHERE code = $1 LIMIT 1`,
			[IFCS_PARAMETER_KEYS.IFC_NOTIFICATION_VARS],
		);
		return paramRow[0]?.value ?? [];
	}

	async dispatch(input: DispatchInput, notificationVars?: NotificationVar[]): Promise<DispatchResult> {
		const { chartId, periodId } = input;
		const ctx = await this.resolveContext(input);
		if (ctx === null) {
			this.logger.log(`dispatch.skip chartId=${chartId} periodId=${periodId} reason=no_course_chart`);
			return { sent: false, reason: 'no_course_chart', recipients_count: 0, cc_count: 0 };
		}

		const config = await this.loadConfig(ctx);
		if (config === null) {
			this.logger.log(`dispatch.skip chartId=${chartId} periodId=${periodId} reason=no_config`);
			return { sent: false, reason: 'no_config', recipients_count: 0, cc_count: 0 };
		}

		const { toEmails, ccEmails, toStaffIds, ccStaffIds } = await this.resolveRecipients(
			ctx.course_chart_id,
			config,
		);
		if (toEmails.length === 0) {
			this.logger.log(`dispatch.skip chartId=${chartId} periodId=${periodId} reason=no_recipients`);
			return { sent: false, reason: 'no_recipients', recipients_count: 0, cc_count: 0 };
		}

		const subs = await this.buildSubstitutions(ctx, input.notifierUserId, notificationVars);
		const lang: 'es' | 'en' = 'es';

		const subject = applySubstitutions(config.title[lang] ?? config.title.es ?? '', subs);
		const html = applySubstitutions(config.body[lang] ?? config.body.es ?? '', subs);

		try {
			const { messageId } = await this.mailService.sendRawEmail({
				to: toEmails.join(','),
				cc: ccEmails,
				subject,
				html,
			});

			await this.writeLog(ctx, config, toStaffIds, ccStaffIds, input.notifierUserId, messageId);

			this.logger.log(`dispatch.sent chartId=${chartId} periodId=${periodId} ifcId=${ctx.ifc_id} recipients=${toEmails.length} cc=${ccEmails.length}`);
			return {
				sent: true,
				recipients_count: toEmails.length,
				cc_count: ccEmails.length,
				reason: null,
			};
		} catch (e) {
			this.logger.error(`dispatch.failed chartId=${chartId} periodId=${periodId} ifcId=${ctx.ifc_id}: ${(e as Error).message}`);
			return { sent: false, reason: 'send_failed', recipients_count: 0, cc_count: 0 };
		}
	}

	private async resolveContext(input: DispatchInput): Promise<ResolvedContext | null> {
		const rows = await this.dataSource.query(
			`
			WITH course_chart AS (
				SELECT c.id, c.staff_id, c.entity_code AS course_id, c.root_chart_detail_id
				FROM organization.charts c
				JOIN organization.chart_levels cl ON cl.id = c.chart_level_id
				JOIN core.types ct                ON ct.id = cl.level_type_id
				WHERE c.id        = $1
				  AND ct.code     = $4
				  AND c.academic_period_id = $2
				  AND c.is_active = true
				LIMIT 1
			),
			school_walk AS (
				SELECT cc.root_chart_detail_id AS id, 1 AS depth
				FROM course_chart cc

				UNION ALL

				SELECT c.root_chart_detail_id, sw.depth + 1
				FROM organization.charts c
				JOIN school_walk sw ON c.id = sw.id
				WHERE c.is_active = true AND sw.depth < 20
			),
			school_chart AS (
				SELECT c.entity_code AS school_id
				FROM school_walk sw
				JOIN organization.charts c  ON c.id = sw.id
				JOIN core.types ct          ON ct.id = c.entity_type_id
				WHERE ct.code = $6
				LIMIT 1
			)
			SELECT
				cc.id::int                                                                            AS course_chart_id,
				(SELECT school_id FROM school_chart)::int                                             AS school_id,
				$2::int                                                                               AS period_id,
				(SELECT id::int FROM core.types WHERE code = $3)                                      AS trigger_type_id,
				(SELECT id::int FROM core.types WHERE code = $5)                                      AS ifc_status_type_id,
				(SELECT i.id::int FROM evidence.ifcs i WHERE i.course_id = cc.course_id AND i.academic_period_id = $2 LIMIT 1) AS ifc_id,
				(SELECT ap.code FROM academic.academic_periods ap WHERE ap.id = $2)                   AS period_code,
				(SELECT ac.name FROM academic.courses ac WHERE ac.id = cc.course_id)                  AS course_name,
				(SELECT u.first_name || ' ' || u.last_name
					 FROM organization.staff s JOIN organization.users u ON u.id = s.user_id
					 WHERE s.id = cc.staff_id)                                                        AS coordinator_name
			FROM course_chart cc
			`,
			[
				input.chartId,
				input.periodId,
				input.triggerCode,
				TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR,
				input.ifcStatusCode,
				TYPE_CODES.ENTITY_TYPE.SCHOOL,
			],
		);

		if (rows.length === 0 || rows[0].school_id == null) return null;
		return rows[0] as ResolvedContext;
	}

	private async loadConfig(ctx: ResolvedContext): Promise<LoadedConfig | null> {
		const rows = await this.dataSource.query(
			`
			SELECT
				nc.id::int                     AS id,
				nc.title                       AS title,
				nc.body                        AS body,
				nc.to_chart_level_type_ids     AS to_chart_level_type_ids,
				nc.cc_chart_level_type_ids     AS cc_chart_level_type_ids
			FROM ifc.notification_configs nc
			WHERE nc.school_id          = $1
			  AND nc.academic_period_id = $2
			  AND nc.trigger_type_id    = $3
			  AND nc.ifc_status_type_id = $4
			  AND nc.is_active          = true
			LIMIT 1
			`,
			[ctx.school_id, ctx.period_id, ctx.trigger_type_id, ctx.ifc_status_type_id],
		);
		return (rows[0] as LoadedConfig | undefined) ?? null;
	}

	private async resolveRecipients(courseChartId: number, config: LoadedConfig) {
		const toIds = (config.to_chart_level_type_ids ?? []).map((n) => Number(n));
		const ccIds = (config.cc_chart_level_type_ids ?? []).map((n) => Number(n));
		const wanted = [...toIds, ...ccIds];
		if (wanted.length === 0) return { toEmails: [], ccEmails: [], toStaffIds: [], ccStaffIds: [] };

		const rows = await this.dataSource.query(
			`
			WITH RECURSIVE chain_up AS (
				SELECT c.id, c.root_chart_detail_id, c.chart_level_id, c.staff_id, 1 AS depth
				FROM organization.charts c
				WHERE c.id = $1 AND c.is_active = true

				UNION ALL

				SELECT c.id, c.root_chart_detail_id, c.chart_level_id, c.staff_id, cu.depth + 1
				FROM organization.charts c
				JOIN chain_up cu ON c.id = cu.root_chart_detail_id
				WHERE c.is_active = true AND cu.depth < 20
			)
			SELECT cl.level_type_id::int AS level_type_id, s.id::int AS staff_id, s.staff_email AS staff_email
			FROM chain_up cu
			JOIN organization.chart_levels cl ON cl.id = cu.chart_level_id
			JOIN organization.staff s         ON s.id  = cu.staff_id
			WHERE cl.level_type_id = ANY($2::int[])
			  AND s.staff_email IS NOT NULL
			`,
			[courseChartId, wanted],
		);

		const toSet = new Set(toIds);
		const ccSet = new Set(ccIds);

		const toPairs: Array<{ email: string; staffId: number }> = [];
		const ccPairs: Array<{ email: string; staffId: number }> = [];
		for (const r of rows) {
			const levelTypeId = Number(r.level_type_id);
			const pair = { email: r.staff_email as string, staffId: Number(r.staff_id) };
			if (toSet.has(levelTypeId)) toPairs.push(pair);
			else if (ccSet.has(levelTypeId)) ccPairs.push(pair);
		}

		// De-dupe by email within each list; drop Cc entries already in To.
		const seenTo = new Set<string>();
		const toEmails: string[] = [];
		const toStaffIds: number[] = [];
		for (const p of toPairs) {
			if (seenTo.has(p.email)) continue;
			seenTo.add(p.email);
			toEmails.push(p.email);
			toStaffIds.push(p.staffId);
		}
		const seenCc = new Set<string>();
		const ccEmails: string[] = [];
		const ccStaffIds: number[] = [];
		for (const p of ccPairs) {
			if (seenTo.has(p.email) || seenCc.has(p.email)) continue;
			seenCc.add(p.email);
			ccEmails.push(p.email);
			ccStaffIds.push(p.staffId);
		}
		return { toEmails, ccEmails, toStaffIds, ccStaffIds };
	}

	private async buildSubstitutions(
		ctx: ResolvedContext,
		notifierUserId: number | null,
		preloadedVars?: NotificationVar[],
	): Promise<Record<string, string>> {
		const vars: NotificationVar[] = preloadedVars ?? await this.loadNotificationVars();

		const statusCode = await this.lookupStatusCode(ctx.ifc_status_type_id);

		const subs: Record<string, string> = {};
		const allowed = (v: NotificationVar) =>
			v.valid_status_codes === null || v.valid_status_codes.includes(statusCode);

		for (const v of vars) {
			const key = v.var;
			if (!allowed(v)) {
				subs[key] = '';
				continue;
			}

			switch (key) {
				case '{{course_name}}':
					subs[key] = (ctx.course_name?.es ?? '') as string;
					break;
				case '{{coordinator_name}}':
					subs[key] = ctx.coordinator_name ?? '';
					break;
				case '{{academic_period}}':
					subs[key] = ctx.period_code ?? '';
					break;
				case '{{notifier_name}}':
					subs[key] = await this.lookupUserName(notifierUserId);
					break;
				case '{{ifc_link}}':
					subs[key] = this.buildIfcLink(ctx.ifc_id);
					break;
				case '{{observer_name}}':
					subs[key] = await this.lookupLatestStatusUserName(
						ctx.ifc_id,
						TYPE_CODES.IFC_STATUS.OBSERVED,
					);
					break;
				case '{{comment}}':
					subs[key] = await this.lookupLatestStatusComment(
						ctx.ifc_id,
						TYPE_CODES.IFC_STATUS.OBSERVED,
					);
					break;
				case '{{submitter_name}}':
					subs[key] = await this.lookupLatestStatusUserName(
						ctx.ifc_id,
						TYPE_CODES.IFC_STATUS.SUBMITTED,
					);
					break;
				default:
					subs[key] = '';
			}
		}
		return subs;
	}

	private async lookupStatusCode(statusTypeId: number): Promise<string> {
		const rows = await this.dataSource.query(`SELECT code FROM core.types WHERE id = $1 LIMIT 1`, [
			statusTypeId,
		]);
		return rows[0]?.code ?? '';
	}

	private async lookupUserName(userId: number | null): Promise<string> {
		if (userId === null) return '';
		const rows = await this.dataSource.query(
			`SELECT first_name || ' ' || last_name AS name FROM organization.users WHERE id = $1 LIMIT 1`,
			[userId],
		);
		return rows[0]?.name ?? '';
	}

	private async lookupLatestStatusUserName(
		ifcId: number | null,
		statusCode: string,
	): Promise<string> {
		if (ifcId === null) return '';
		const rows = await this.dataSource.query(
			`
			SELECT u.first_name || ' ' || u.last_name AS name
			FROM ifc.statuses s
			JOIN core.types t              ON t.id = s.status_type_id
			LEFT JOIN organization.staff st ON st.id = s.staff_id
			LEFT JOIN organization.users u  ON u.id = st.user_id
			WHERE s.ifc_id = $1 AND t.code = $2
			ORDER BY s.register_at DESC
			LIMIT 1
			`,
			[ifcId, statusCode],
		);
		return rows[0]?.name ?? '';
	}

	private async lookupLatestStatusComment(
		ifcId: number | null,
		statusCode: string,
	): Promise<string> {
		if (ifcId === null) return '';
		const rows = await this.dataSource.query(
			`
			SELECT s.comment AS comment
			FROM ifc.statuses s
			JOIN core.types t ON t.id = s.status_type_id
			WHERE s.ifc_id = $1 AND t.code = $2
			ORDER BY s.register_at DESC
			LIMIT 1
			`,
			[ifcId, statusCode],
		);
		const comment = rows[0]?.comment;
		if (!comment) return '';
		if (typeof comment === 'string') return comment;
		return (comment.es ?? comment.en ?? '') as string;
	}

	private buildIfcLink(ifcId: number | null): string {
		const base = this.configService.get<string>('APP_FRONTEND_URL') ?? 'http://localhost:3000';
		if (ifcId === null) return `${base}/ifcs`;
		return `${base}/ifcs/${ifcId}`;
	}

	private async writeLog(
		ctx: ResolvedContext,
		config: LoadedConfig,
		toStaffIds: number[],
		ccStaffIds: number[],
		notifierUserId: number | null,
		messageId: string,
	) {
		await this.notificationLogService.create({
			ifc_id: ctx.ifc_id,
			chart_id: ctx.course_chart_id,
			notification_config_id: config.id,
			notifier_user_id: notifierUserId,
			to_staff_ids: toStaffIds,
			cc_staff_ids: ccStaffIds,
			provider_message_id: messageId,
		});
	}
}

function escapeHtml(value: string): string {
	return value.replace(/[<>&"']/g, (ch) => {
		switch (ch) {
			case '<': return '&lt;';
			case '>': return '&gt;';
			case '&': return '&amp;';
			case '"': return '&quot;';
			case "'": return '&#39;';
			default: return ch;
		}
	});
}

function applySubstitutions(text: string, subs: Record<string, string>): string {
	return text.replace(/\{\{[^}]+\}\}/g, (m) => escapeHtml(subs[m] ?? ''));
}
