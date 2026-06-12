import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { NotificationMessageEntity } from '../model/notification-messages.entity';
import {
	CreateNotificationMessageDto,
	UpdateNotificationMessageDto,
} from '../model/notification-messages.dtos';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

export class NotificationMessageRepository extends BaseRepository<NotificationMessageEntity> {
	constructor(
		@InjectRepository(NotificationMessageEntity)
		repository: Repository<NotificationMessageEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	// Creates the SURVEY email template AND the message in a single transaction.
	async createWithTemplate(dto: CreateNotificationMessageDto) {
		return await this.dataSource.transaction(async (manager) => {
			const { name, subject, body, ...rest } = dto;
			const code = `SURVEY_${dto.surveyTypeId}_${dto.programId}`;
			const emailTemplateId = await this.upsertTemplate(manager, code, { name, subject, body });
			return await this.create({ ...rest, emailTemplateId }, manager);
		});
	}

	async updateWithTemplate(id: number, dto: UpdateNotificationMessageDto) {
		return await this.dataSource.transaction(async (manager) => {
			const { name, subject, body, ...rest } = dto;
			const entity = await this.findOneById(id);

			if (entity?.emailTemplateId && (name || subject || body)) {
				await manager.query(
					`UPDATE core.email_templates
					 SET name = COALESCE($2::jsonb, name),
						 subject = COALESCE($3::jsonb, subject),
						 body = COALESCE($4::jsonb, body),
						 updated_at = NOW()
					 WHERE id = $1`,
					[
						entity.emailTemplateId,
						name ? JSON.stringify(name) : null,
						subject ? JSON.stringify(subject) : null,
						body ? JSON.stringify(body) : null,
					],
				);
			}

			return await this.update(id, rest, manager);
		});
	}

	private async upsertTemplate(
		manager: EntityManager,
		code: string,
		content: { name: unknown; subject: unknown; body: unknown },
	): Promise<number> {
		const rows = await manager.query(
			`
			INSERT INTO core.email_templates (category_type_id, code, name, subject, body)
			SELECT t.id, $1, $2::jsonb, $3::jsonb, $4::jsonb
			FROM core.types t
			WHERE t.code = $5
			ON CONFLICT ON CONSTRAINT "UQ_email_templates_code" DO UPDATE
			SET name = EXCLUDED.name, subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = NOW()
			RETURNING id::int AS "id"
			`,
			[
				code,
				JSON.stringify(content.name),
				JSON.stringify(content.subject),
				JSON.stringify(content.body),
				TYPE_CODES.EMAIL_TEMPLATE_CATEGORY.SURVEY,
			],
		);
		return rows[0]?.id;
	}
}
