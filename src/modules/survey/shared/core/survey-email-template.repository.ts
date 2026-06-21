import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { EmailTemplateEntity } from 'src/modules/core/email-templates/model/email-templates.entity';

export interface SurveyEmailTemplateRow {
	subject: unknown;
	body: unknown;
}

@Injectable()
export class SurveyEmailTemplateRepository extends BaseRepository<EmailTemplateEntity> {
	constructor(
		@InjectRepository(EmailTemplateEntity)
		repository: Repository<EmailTemplateEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	/**
	 * Program-specific template configured in survey.notification_messages, linked to its
	 * email template. The email_template_id link column is guaranteed by migration
	 * 1778977562000-add-email-templates-and-notification-logs.
	 */
	async findNotificationMessageTemplate(
		surveyTypeCode: string,
	): Promise<SurveyEmailTemplateRow | null> {
		const rows = await this.dataSource.query(
			`SELECT et.subject AS "subject", et.body AS "body"
				FROM survey.notification_messages nm
				INNER JOIN core.email_templates et ON et.id = nm.email_template_id
				INNER JOIN core.types t ON t.id = nm.survey_type_id
				WHERE t.code = $1
				AND nm.is_active = true
				ORDER BY nm.id ASC
				LIMIT 1`,
			[surveyTypeCode],
		);
		return rows?.[0] ?? null;
	}

	/**
	 * Default template for the survey type: core.email_templates keyed by the survey type
	 * code (e.g. TG601-T001 for GRA). Decoupled from notification_messages.
	 */
	async findDefaultTemplateByCode(surveyTypeCode: string): Promise<SurveyEmailTemplateRow | null> {
		const rows = await this.dataSource.query(
			`SELECT et.subject AS "subject", et.body AS "body"
				FROM core.email_templates et
				WHERE et.code = $1
				AND et.is_active = true
				ORDER BY et.id ASC
				LIMIT 1`,
			[surveyTypeCode],
		);
		return rows?.[0] ?? null;
	}
}
