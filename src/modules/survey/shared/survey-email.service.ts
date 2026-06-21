import { Injectable, NotFoundException } from '@nestjs/common';
import { SurveyEmailTemplateRepository } from './core/survey-email-template.repository';

@Injectable()
export class SurveyEmailTemplateService {
	constructor(private readonly emailTemplateRepo: SurveyEmailTemplateRepository) {}

	async getEmailTemplate(
		surveyTypeCode: string,
		lang: 'es' | 'en' = 'es',
	): Promise<{ subject: string; body: string }> {
		const message = await this.emailTemplateRepo.findNotificationMessageTemplate(surveyTypeCode);
		if (message) {
			return { subject: pickLocale(message.subject, lang), body: pickLocale(message.body, lang) };
		}

		const fallback = await this.emailTemplateRepo.findDefaultTemplateByCode(surveyTypeCode);
		if (fallback) {
			return { subject: pickLocale(fallback.subject, lang), body: pickLocale(fallback.body, lang) };
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
