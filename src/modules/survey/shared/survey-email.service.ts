import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SurveyEmailTemplateService {
	constructor(private readonly dataSource: DataSource) {}

	async getEmailTemplate(surveyTypeCode: string): Promise<{ subject: string; body: string }> {
		const rows = await this.dataSource.query(
			`SELECT nm.title, nm.body
				FROM survey.notification_messages nm
				INNER JOIN core.types t ON t.id = nm.survey_type_id
				WHERE t.code = $1
				AND nm.is_active = true
				ORDER BY nm.id ASC
				LIMIT 1`,
			[surveyTypeCode],
		);

		if (rows?.[0]) {
			return { subject: rows[0].title, body: rows[0].body };
		}

		throw new NotFoundException('error.survey.emailTemplateMissing');
	}

	replacePlaceholders(template: string, data: Record<string, string>): string {
		let result = template;
		for (const [key, value] of Object.entries(data)) {
			result = result.replaceAll(`[${key}]`, value ?? '');
		}
		return result;
	}
}
