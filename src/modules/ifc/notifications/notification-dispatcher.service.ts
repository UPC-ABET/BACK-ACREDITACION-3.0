import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from 'src/modules/mail/mail.service';
import { NotificationLogService } from 'src/modules/core/notification-logs/api/notification-logs.service';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import type { I18nText } from 'src/shared/types/i18n';
import { NotificationDispatcherRepository } from './core/notification-dispatcher.repository';

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
		private readonly notificationDispatcherRepository: NotificationDispatcherRepository,
		private readonly mailService: MailService,
		private readonly configService: ConfigService,
		private readonly notificationLogService: NotificationLogService,
	) {}

	async loadNotificationVars(): Promise<NotificationVar[]> {
		return this.notificationDispatcherRepository.loadNotificationVars();
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

	/**
	 * Fire-and-forget auto status-change notification, dispatched after the caller's
	 * transaction has committed. The status code is whatever the transition actually
	 * wrote — the config table decides whether anything is sent, so no status is ever
	 * hardcoded here. No-ops silently when no matching config exists.
	 */
	dispatchStatusChangeAsync(input: {
		chartId: number | null;
		periodId: number;
		ifcStatusCode: string;
		notifierUserId: number;
		ifcId?: number | null;
	}): void {
		if (
			input.chartId === null ||
			!Number.isFinite(input.chartId) ||
			!Number.isFinite(input.periodId)
		) {
			return;
		}
		const chartId = input.chartId;
		setImmediate(() => {
			this.dispatch({
				chartId,
				periodId: input.periodId,
				triggerCode: TYPE_CODES.NOTIFICATION_TRIGGER.AUTO_STATUS_CHANGE,
				ifcStatusCode: input.ifcStatusCode,
				notifierUserId: input.notifierUserId,
			}).catch((err) =>
				this.logger.error(`dispatch.failed ifcId=${input.ifcId ?? '?'}: ${(err as Error).message}`),
			);
		});
	}

	private async resolveContext(input: DispatchInput): Promise<ResolvedContext | null> {
		return this.notificationDispatcherRepository.resolveContext({
			chartId: input.chartId,
			periodId: input.periodId,
			triggerCode: input.triggerCode,
			ifcStatusCode: input.ifcStatusCode,
		});
	}

	private async loadConfig(ctx: ResolvedContext): Promise<LoadedConfig | null> {
		return this.notificationDispatcherRepository.loadConfig(ctx.triggerTypeId, ctx.ifcStatusTypeId);
	}

	private async resolveRecipients(courseChartId: number, config: LoadedConfig) {
		const toIds = (config.toChartEntityTypeIds ?? []).map((n) => Number(n));
		const ccIds = (config.ccChartEntityTypeIds ?? []).map((n) => Number(n));
		const wanted = [...toIds, ...ccIds];
		if (wanted.length === 0) return { toEmails: [], ccEmails: [], toStaffIds: [], ccStaffIds: [] };

		const rows = await this.notificationDispatcherRepository.resolveRecipients(
			courseChartId,
			wanted,
		);

		const toSet = new Set(toIds);
		const ccSet = new Set(ccIds);

		const toPairs: Array<{ email: string; staffId: number }> = [];
		const ccPairs: Array<{ email: string; staffId: number }> = [];
		for (const r of rows) {
			const entityTypeId = Number(r.entityTypeId);
			const pair = { email: r.staffEmail, staffId: Number(r.staffId) };
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
					subs[key] = this.buildIfcLink(ctx);
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
		return this.notificationDispatcherRepository.lookupStatusCode(statusTypeId);
	}

	private async lookupUserName(userId: number | null): Promise<string> {
		if (userId === null) return '';
		return this.notificationDispatcherRepository.lookupUserName(userId);
	}

	private async lookupLatestStatusUserName(
		ifcId: number | null,
		statusCode: string,
	): Promise<string> {
		if (ifcId === null) return '';
		return this.notificationDispatcherRepository.lookupLatestStatusUserName(ifcId, statusCode);
	}

	private async lookupLatestStatusComment(
		ifcId: number | null,
		statusCode: string,
	): Promise<string> {
		if (ifcId === null) return '';
		const comment = await this.notificationDispatcherRepository.lookupLatestStatusComment(
			ifcId,
			statusCode,
		);
		if (!comment) return '';
		if (typeof comment === 'string') return comment;
		return comment.es ?? comment.en ?? '';
	}

	private buildIfcLink(ctx: ResolvedContext): string {
		const base = this.configService.get<string>('APP_FRONTEND_URL');
		if (ctx.ifcId === null) {
			return `${base}/ifcs/new?chartId=${ctx.courseChartId}&periodId=${ctx.periodId}`;
		}
		return `${base}/ifcs/${ctx.ifcId}`;
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
		return this.notificationDispatcherRepository.lookupTypeIdByCode(code);
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
