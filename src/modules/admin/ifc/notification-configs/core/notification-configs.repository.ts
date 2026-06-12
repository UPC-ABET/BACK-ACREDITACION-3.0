import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { NotificationConfigEntity } from '../model/notification-configs.entity';
import { UpsertNotificationConfigDto } from '../model/notification-configs.dtos';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

export class NotificationConfigRepository extends BaseRepository<NotificationConfigEntity> {
	constructor(
		@InjectRepository(NotificationConfigEntity)
		repository: Repository<NotificationConfigEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findByPeriod(schoolId: number, periodId: number) {
		return await this.dataSource.query(
			`
			SELECT
				nc.id::int                       AS "id",
				nc.school_id::int                AS "schoolId",
				nc.academic_period_id::int       AS "academicPeriodId",
				nc.trigger_type_id::int          AS "triggerTypeId",
				nc.ifc_status_type_id::int       AS "ifcStatusTypeId",
				nc.email_template_id::int        AS "emailTemplateId",
				et.name                          AS "name",
				et.subject                       AS "subject",
				et.body                          AS "body",
				nc.to_chart_entity_type_ids       AS "toChartEntityTypeIds",
				nc.cc_chart_entity_type_ids       AS "ccChartEntityTypeIds",
				nc.is_active                     AS "isActive",
				ct_trigger.code                  AS "triggerCode",
				ct_trigger.name                  AS "triggerName",
				ct_status.code                   AS "statusCode",
				ct_status.name                   AS "statusName"
			FROM ifc.notification_configs nc
			JOIN core.types ct_trigger ON ct_trigger.id = nc.trigger_type_id
			JOIN core.types ct_status  ON ct_status.id  = nc.ifc_status_type_id
			JOIN core.email_templates et ON et.id = nc.email_template_id
			WHERE nc.school_id          = $1
			  AND nc.academic_period_id = $2
			  AND nc.is_active          = true
			ORDER BY ct_trigger.code, ct_status.code
			`,
			[schoolId, periodId],
		);
	}

	/*
	 * Creates/updates the IFC email template AND the notification config in a single
	 * transaction. The template is keyed by a deterministic code derived from the config
	 * scope, so re-saving the same config updates its template in place (1:1).
	 */
	async upsertWithTemplate(schoolId: number, dto: UpsertNotificationConfigDto) {
		return await this.dataSource.transaction(async (manager) => {
			const templateCode = `IFC_${schoolId}_${dto.academicPeriodId}_${dto.triggerTypeId}_${dto.ifcStatusTypeId}`;

			const tplRows = await manager.query(
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
					templateCode,
					JSON.stringify(dto.name),
					JSON.stringify(dto.subject),
					JSON.stringify(dto.body),
					TYPE_CODES.EMAIL_TEMPLATE_CATEGORY.IFC,
				],
			);
			const emailTemplateId = tplRows[0]?.id;

			const rows = await manager.query(
				`
				INSERT INTO ifc.notification_configs
					(school_id, academic_period_id, trigger_type_id, ifc_status_type_id,
					 email_template_id, to_chart_entity_type_ids, cc_chart_entity_type_ids, is_active)
				VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
				ON CONFLICT ON CONSTRAINT "UQ_notification_configs_school_period_trigger_status" DO UPDATE
				SET email_template_id         = EXCLUDED.email_template_id,
					to_chart_entity_type_ids   = EXCLUDED.to_chart_entity_type_ids,
					cc_chart_entity_type_ids   = EXCLUDED.cc_chart_entity_type_ids,
					is_active                 = EXCLUDED.is_active,
					updated_at                = NOW()
				RETURNING id::int                       AS "id",
						  school_id::int                AS "schoolId",
						  academic_period_id::int       AS "academicPeriodId",
						  trigger_type_id::int          AS "triggerTypeId",
						  ifc_status_type_id::int       AS "ifcStatusTypeId",
						  email_template_id::int        AS "emailTemplateId",
						  to_chart_entity_type_ids       AS "toChartEntityTypeIds",
						  cc_chart_entity_type_ids       AS "ccChartEntityTypeIds",
						  is_active                     AS "isActive"
				`,
				[
					schoolId,
					dto.academicPeriodId,
					dto.triggerTypeId,
					dto.ifcStatusTypeId,
					emailTemplateId,
					JSON.stringify(dto.toChartEntityTypeIds ?? []),
					JSON.stringify(dto.ccChartEntityTypeIds ?? []),
					dto.isActive ?? true,
				],
			);

			return { ...rows[0], name: dto.name, subject: dto.subject, body: dto.body };
		});
	}

	async softDeleteForSchool(schoolId: number, id: number) {
		await this.dataSource.query(
			`UPDATE ifc.notification_configs SET is_active = false, updated_at = NOW() WHERE id = $1 AND school_id = $2`,
			[id, schoolId],
		);
	}
}
