import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { NotificationConfigRepository } from '../core/notification-configs.repository';
import { NotificationConfigValidation } from '../core/notification-configs.validation';

import {
	CreateNotificationConfigDto,
	UpdateNotificationConfigDto,
	UpsertNotificationConfigDto,
} from '../model/notification-configs.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class NotificationConfigService extends BaseService<NotificationConfigRepository> {
	constructor(
		protected readonly repository: NotificationConfigRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateNotificationConfigDto, manager?: EntityManager) {
		await NotificationConfigValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateNotificationConfigDto, manager?: EntityManager) {
		await NotificationConfigValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await NotificationConfigValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async byPeriod(schoolId: number, periodId: number) {
		return await this.dataSource.query(
			`
			SELECT
				nc.id::int                       AS "id",
				nc.school_id::int                AS "schoolId",
				nc.academic_period_id::int       AS "academicPeriodId",
				nc.trigger_type_id::int          AS "triggerTypeId",
				nc.ifc_status_type_id::int       AS "ifcStatusTypeId",
				nc.title                         AS "title",
				nc.body                          AS "body",
				nc.to_chart_level_type_ids       AS "toChartLevelTypeIds",
				nc.cc_chart_level_type_ids       AS "ccChartLevelTypeIds",
				nc.is_active                     AS "isActive",
				ct_trigger.code                  AS "triggerCode",
				ct_trigger.name                  AS "triggerName",
				ct_status.code                   AS "statusCode",
				ct_status.name                   AS "statusName"
			FROM ifc.notification_configs nc
			JOIN core.types ct_trigger ON ct_trigger.id = nc.trigger_type_id
			JOIN core.types ct_status  ON ct_status.id  = nc.ifc_status_type_id
			WHERE nc.school_id          = $1
			  AND nc.academic_period_id = $2
			  AND nc.is_active          = true
			ORDER BY ct_trigger.code, ct_status.code
			`,
			[schoolId, periodId],
		);
	}

	async upsert(schoolId: number, dto: UpsertNotificationConfigDto) {
		const rows = await this.dataSource.query(
			`
			INSERT INTO ifc.notification_configs
				(school_id, academic_period_id, trigger_type_id, ifc_status_type_id,
				 title, body, to_chart_level_type_ids, cc_chart_level_type_ids, is_active)
			VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9)
			ON CONFLICT ON CONSTRAINT "UQ_4689ce4c54254910a1e7ab56b1c" DO UPDATE
			SET title                     = EXCLUDED.title,
				body                      = EXCLUDED.body,
				to_chart_level_type_ids   = EXCLUDED.to_chart_level_type_ids,
				cc_chart_level_type_ids   = EXCLUDED.cc_chart_level_type_ids,
				is_active                 = EXCLUDED.is_active,
				updated_at                = NOW()
			RETURNING id::int                       AS "id",
					  school_id::int                AS "schoolId",
					  academic_period_id::int       AS "academicPeriodId",
					  trigger_type_id::int          AS "triggerTypeId",
					  ifc_status_type_id::int       AS "ifcStatusTypeId",
					  title, body,
					  to_chart_level_type_ids       AS "toChartLevelTypeIds",
					  cc_chart_level_type_ids       AS "ccChartLevelTypeIds",
					  is_active                     AS "isActive"
			`,
			[
				schoolId,
				dto.academicPeriodId,
				dto.triggerTypeId,
				dto.ifcStatusTypeId,
				JSON.stringify(dto.title),
				JSON.stringify(dto.body),
				JSON.stringify(dto.toChartLevelTypeIds ?? []),
				JSON.stringify(dto.ccChartLevelTypeIds ?? []),
				dto.isActive ?? true,
			],
		);
		return rows[0];
	}

	async softDelete(schoolId: number, id: number) {
		await this.dataSource.query(
			`
			UPDATE ifc.notification_configs
			SET is_active = false, updated_at = NOW()
			WHERE id = $1 AND school_id = $2
			`,
			[id, schoolId],
		);
	}
}
