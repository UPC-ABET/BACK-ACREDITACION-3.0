import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SurveyEmailTemplateService {
	constructor(private readonly dataSource: DataSource) {}

	async getEmailTemplate(
		surveyTypeCode: string,
		lang: 'es' | 'en' = 'es',
	): Promise<{ subject: string; body: string }> {
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

		throw new NotFoundException('error.survey.emailTemplateMissing');
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
