import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { MailService } from 'src/modules/mail/mail.service';
import { NotificationLogService } from 'src/modules/core/notification-logs/api/notification-logs.service';
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
	recipientsCount: number;
	ccCount: number;
	reason: DispatchReason;
};

interface ResolvedContext {
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

interface LoadedConfig {
	id: number;
	emailTemplateId: number | null;
	subject: I18nText;
	body: I18nText;
	toChartEntityTypeIds: number[] | null;
	ccChartEntityTypeIds: number[] | null;
}

interface NotificationVar {
	var: string;
	validStatusCodes: string[] | null;
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
		const rows: Array<{ var: string; valid_status_codes: string[] | null }> =
			paramRow[0]?.value ?? [];
		// JSONB content stays snake_case in the DB; map to camelCase at the boundary.
		return rows.map((r) => ({ var: r.var, validStatusCodes: r.valid_status_codes }));
	}

	async dispatch(
		input: DispatchInput,
		notificationVars?: NotificationVar[],
	): Promise<DispatchResult> {
		const { chartId, periodId } = input;
		const ctx = await this.resolveContext(input);
		if (ctx === null) {
			this.logger.log(
				`dispatch.skip chartId=${chartId} periodId=${periodId} reason=no_course_chart`,
			);
			return { sent: false, reason: 'no_course_chart', recipientsCount: 0, ccCount: 0 };
		}

		const config = await this.loadConfig(ctx);
		if (config === null) {
			this.logger.log(`dispatch.skip chartId=${chartId} periodId=${periodId} reason=no_config`);
			return { sent: false, reason: 'no_config', recipientsCount: 0, ccCount: 0 };
		}

		const { toEmails, ccEmails, toStaffIds, ccStaffIds } = await this.resolveRecipients(
			ctx.courseChartId,
			config,
		);
		if (toEmails.length === 0) {
			this.logger.log(`dispatch.skip chartId=${chartId} periodId=${periodId} reason=no_recipients`);
			return { sent: false, reason: 'no_recipients', recipientsCount: 0, ccCount: 0 };
		}

		const subs = await this.buildSubstitutions(ctx, input.notifierUserId, notificationVars);
		const lang: 'es' | 'en' = 'es';

		const subject = applySubstitutions(config.subject[lang] ?? config.subject.es ?? '', subs);
		const html = applySubstitutions(config.body[lang] ?? config.body.es ?? '', subs);

		try {
			const { messageId } = await this.mailService.sendRawEmail({
				to: toEmails.join(','),
				cc: ccEmails,
				subject,
				html,
			});

			await this.writeLog(
				ctx,
				config,
				toEmails,
				ccEmails,
				toStaffIds,
				ccStaffIds,
				input.notifierUserId,
				messageId,
			);

			this.logger.log(
				`dispatch.sent chartId=${chartId} periodId=${periodId} ifcId=${ctx.ifcId} recipients=${toEmails.length} cc=${ccEmails.length}`,
			);
			return {
				sent: true,
				recipientsCount: toEmails.length,
				ccCount: ccEmails.length,
				reason: null,
			};
		} catch (e) {
			this.logger.error(
				`dispatch.failed chartId=${chartId} periodId=${periodId} ifcId=${ctx.ifcId}: ${(e as Error).message}`,
			);
			return { sent: false, reason: 'send_failed', recipientsCount: 0, ccCount: 0 };
		}
	}

	private async resolveContext(input: DispatchInput): Promise<ResolvedContext | null> {
		const rows = await this.dataSource.query(
			`
			WITH RECURSIVE course_chart AS (
				SELECT c.id, c.staff_id, c.entity_code AS course_id, c.root_chart_id
				FROM organization.charts c
				JOIN core.types ct                ON ct.id = c.entity_type_id
				WHERE c.id        = $1
				  AND ct.code     = $4
				  AND c.academic_period_id = $2
				  AND c.is_active = true
				LIMIT 1
			),
			school_walk AS (
				SELECT cc.root_chart_id AS id, 1 AS depth
				FROM course_chart cc

				UNION ALL

				SELECT c.root_chart_id, sw.depth + 1
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
				cc.id::int                                                                            AS "courseChartId",
				(SELECT school_id FROM school_chart)::int                                             AS "schoolId",
				$2::int                                                                               AS "periodId",
				(SELECT id::int FROM core.types WHERE code = $3)                                      AS "triggerTypeId",
				(SELECT id::int FROM core.types WHERE code = $5)                                      AS "ifcStatusTypeId",
				(SELECT i.id::int FROM evidence.ifcs i WHERE i.course_id = cc.course_id AND i.academic_period_id = $2 LIMIT 1) AS "ifcId",
				(SELECT ap.code FROM academic.academic_periods ap WHERE ap.id = $2)                   AS "periodCode",
				(SELECT ac.name FROM academic.courses ac WHERE ac.id = cc.course_id)                  AS "courseName",
				(SELECT u.first_name || ' ' || u.last_name
					 FROM organization.staff s JOIN organization.users u ON u.id = s.user_id
					 WHERE s.id = cc.staff_id)                                                        AS "coordinatorName"
			FROM course_chart cc
			`,
			[
				input.chartId,
				input.periodId,
				input.triggerCode,
				TYPE_CODES.ENTITY_TYPE.COURSE,
				input.ifcStatusCode,
				TYPE_CODES.ENTITY_TYPE.SCHOOL,
			],
		);

		if (rows.length === 0 || rows[0].schoolId == null) return null;
		return rows[0] as ResolvedContext;
	}

	private async loadConfig(ctx: ResolvedContext): Promise<LoadedConfig | null> {
		const rows = await this.dataSource.query(
			`
			SELECT
				nc.id::int                     AS "id",
				nc.email_template_id::int      AS "emailTemplateId",
				et.subject                     AS "subject",
				et.body                        AS "body",
				nc.to_chart_entity_type_ids     AS "toChartEntityTypeIds",
				nc.cc_chart_entity_type_ids     AS "ccChartEntityTypeIds"
			FROM ifc.notification_configs nc
			JOIN core.email_templates et ON et.id = nc.email_template_id
			WHERE nc.school_id          = $1
			  AND nc.academic_period_id = $2
			  AND nc.trigger_type_id    = $3
			  AND nc.ifc_status_type_id = $4
			  AND nc.is_active          = true
			LIMIT 1
			`,
			[ctx.schoolId, ctx.periodId, ctx.triggerTypeId, ctx.ifcStatusTypeId],
		);
		return (rows[0] as LoadedConfig | undefined) ?? null;
	}

	private async resolveRecipients(courseChartId: number, config: LoadedConfig) {
		const toIds = (config.toChartEntityTypeIds ?? []).map((n) => Number(n));
		const ccIds = (config.ccChartEntityTypeIds ?? []).map((n) => Number(n));
		const wanted = [...toIds, ...ccIds];
		if (wanted.length === 0) return { toEmails: [], ccEmails: [], toStaffIds: [], ccStaffIds: [] };

		const rows = await this.dataSource.query(
			`
			WITH RECURSIVE chain_up AS (
				SELECT c.id, c.root_chart_id, c.entity_type_id, c.staff_id, 1 AS depth
				FROM organization.charts c
				WHERE c.id = $1 AND c.is_active = true

				UNION ALL

				SELECT c.id, c.root_chart_id, c.entity_type_id, c.staff_id, cu.depth + 1
				FROM organization.charts c
				JOIN chain_up cu ON c.id = cu.root_chart_id
				WHERE c.is_active = true AND cu.depth < 20
			)
			SELECT cu.entity_type_id::int AS "entityTypeId", s.id::int AS "staffId", s.staff_email AS "staffEmail"
			FROM chain_up cu
			JOIN organization.staff s         ON s.id  = cu.staff_id
			WHERE cu.entity_type_id = ANY($2::int[])
			  AND s.staff_email IS NOT NULL
			`,
			[courseChartId, wanted],
		);

		const toSet = new Set(toIds);
		const ccSet = new Set(ccIds);

		const toPairs: Array<{ email: string; staffId: number }> = [];
		const ccPairs: Array<{ email: string; staffId: number }> = [];
		for (const r of rows) {
			const entityTypeId = Number(r.entityTypeId);
			const pair = { email: r.staffEmail as string, staffId: Number(r.staffId) };
			if (toSet.has(entityTypeId)) toPairs.push(pair);
			else if (ccSet.has(entityTypeId)) ccPairs.push(pair);
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
		const vars: NotificationVar[] = preloadedVars ?? (await this.loadNotificationVars());

		const statusCode = await this.lookupStatusCode(ctx.ifcStatusTypeId);

		const subs: Record<string, string> = {};
		const allowed = (v: NotificationVar) =>
			v.validStatusCodes === null || v.validStatusCodes.includes(statusCode);

		for (const v of vars) {
			const key = v.var;
			if (!allowed(v)) {
				subs[key] = '';
				continue;
			}

			switch (key) {
				case '{{course_name}}':
					subs[key] = (ctx.courseName?.es ?? '') as string;
					break;
				case '{{coordinator_name}}':
					subs[key] = ctx.coordinatorName ?? '';
					break;
				case '{{academic_period}}':
					subs[key] = ctx.periodCode ?? '';
					break;
				case '{{notifier_name}}':
					subs[key] = await this.lookupUserName(notifierUserId);
					break;
				case '{{ifc_link}}':
					subs[key] = this.buildIfcLink(ctx.ifcId);
					break;
				case '{{observer_name}}':
					subs[key] = await this.lookupLatestStatusUserName(
						ctx.ifcId,
						TYPE_CODES.IFC_STATUS.OBSERVED,
					);
					break;
				case '{{comment}}':
					subs[key] = await this.lookupLatestStatusComment(
						ctx.ifcId,
						TYPE_CODES.IFC_STATUS.OBSERVED,
					);
					break;
				case '{{submitter_name}}':
					subs[key] = await this.lookupLatestStatusUserName(
						ctx.ifcId,
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
		const base = this.configService.get<string>('APP_FRONTEND_URL');
		if (ifcId === null) return `${base}/ifcs`;
		return `${base}/ifcs/${ifcId}`;
	}

	private async writeLog(
		ctx: ResolvedContext,
		config: LoadedConfig,
		toEmails: string[],
		ccEmails: string[],
		toStaffIds: number[],
		ccStaffIds: number[],
		notifierUserId: number | null,
		messageId: string,
	) {
		const categoryTypeId = await this.lookupTypeIdByCode(TYPE_CODES.EMAIL_TEMPLATE_CATEGORY.IFC);
		if (categoryTypeId === null) return;

		const statusTypeId = await this.lookupTypeIdByCode(TYPE_CODES.NOTIFICATION_LOG_STATUS.SENT);
		if (statusTypeId === null) return;

		await this.notificationLogService.create({
			categoryTypeId,
			emailTemplateId: config.emailTemplateId,
			notifierUserId,
			toEmails,
			ccEmails,
			toStaffIds,
			ccStaffIds,
			providerMessageId: messageId,
			statusTypeId,
			context: {
				ifcId: ctx.ifcId,
				chartId: ctx.courseChartId,
				notificationConfigId: config.id,
			},
		});
	}

	private async lookupTypeIdByCode(code: string): Promise<number | null> {
		const rows =
			(await this.dataSource.query(`SELECT id::int AS id FROM core.types WHERE code = $1 LIMIT 1`, [
				code,
			])) ?? [];
		return rows[0]?.id ?? null;
	}
}

function escapeHtml(value: string): string {
	return value.replace(/[<>&"']/g, (ch) => {
		switch (ch) {
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '&':
				return '&amp;';
			case '"':
				return '&quot;';
			case "'":
				return '&#39;';
			default:
				return ch;
		}
	});
}

function applySubstitutions(text: string, subs: Record<string, string>): string {
	return text.replace(/\{\{[^}]+\}\}/g, (m) => escapeHtml(subs[m] ?? ''));
}
