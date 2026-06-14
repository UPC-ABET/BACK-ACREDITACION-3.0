import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SurveyEmailTemplateService {
	constructor(private readonly dataSource: DataSource) {}

	// Cached check: whether survey.notification_messages carries the email_template_id link.
	// Lets us support both the program-specific mapping (post email-templates migration) and
	// the default-per-survey-type template, without per-call schema lookups or error noise.
	private notificationMessagesLinkSupported: boolean | null = null;

	async getEmailTemplate(
		surveyTypeCode: string,
		lang: 'es' | 'en' = 'es',
	): Promise<{ subject: string; body: string }> {
		// 1) Program-specific template configured in survey.notification_messages, when that
		//    table exposes the email_template_id link column.
		if (await this.supportsNotificationMessageLink()) {
			const rows = await this.dataSource.query(
				`SELECT et.subject AS subject, et.body AS body
					FROM survey.notification_messages nm
					INNER JOIN core.email_templates et ON et.id = nm.email_template_id
					INNER JOIN core.types t ON t.id = nm.survey_type_id
					WHERE t.code = $1
					AND nm.is_active = true
					ORDER BY nm.id ASC
					LIMIT 1`,
				[surveyTypeCode],
			);
			if (rows?.[0]) {
				return { subject: pickLocale(rows[0].subject, lang), body: pickLocale(rows[0].body, lang) };
			}
		}

		// 2) Default template for the survey type: core.email_templates keyed by the survey
		//    type code (e.g. TG601-T001 for GRA). Decoupled from notification_messages.
		const fallback = await this.dataSource.query(
			`SELECT et.subject AS subject, et.body AS body
				FROM core.email_templates et
				WHERE et.code = $1
				AND et.is_active = true
				ORDER BY et.id ASC
				LIMIT 1`,
			[surveyTypeCode],
		);
		if (fallback?.[0]) {
			return {
				subject: pickLocale(fallback[0].subject, lang),
				body: pickLocale(fallback[0].body, lang),
			};
		}

		throw new NotFoundException('error.survey.emailTemplateMissing');
	}

	private async supportsNotificationMessageLink(): Promise<boolean> {
		if (this.notificationMessagesLinkSupported !== null) {
			return this.notificationMessagesLinkSupported;
		}
		const rows = await this.dataSource.query(
			`SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'survey'
				AND table_name = 'notification_messages'
				AND column_name = 'email_template_id'
				LIMIT 1`,
		);
		this.notificationMessagesLinkSupported = rows.length > 0;
		return this.notificationMessagesLinkSupported;
	}

	// Same convention as IFC: mustache `{{var}}` placeholders.
	replacePlaceholders(template: string, data: Record<string, string>): string {
		let result = template;
		for (const [key, value] of Object.entries(data)) {
			result = result.replaceAll(`{{${key}}}`, value ?? '');
		}
		return result;
	}
}

// Templates store an I18nText object ({ es, en }); pick the requested locale. A legacy
// plain-string value is returned as-is.
function pickLocale(value: unknown, lang: 'es' | 'en'): string {
	if (typeof value === 'string') return value;
	if (value && typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		return (obj[lang] as string) ?? (obj.es as string) ?? (obj.en as string) ?? '';
	}
	return '';
}
