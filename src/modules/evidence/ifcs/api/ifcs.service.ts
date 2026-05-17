import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { IfcRepository } from '../core/ifcs.repository';
import { IfcValidation } from '../core/ifcs.validation';

import { CreateIfcDto, ListIfcsDto, UpdateIfcDto } from '../model/ifcs.dtos';
import { DataSource, EntityManager } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

@Injectable()
export class IfcService extends BaseService<IfcRepository> {
	constructor(
		protected readonly repository: IfcRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateIfcDto, manager?: EntityManager) {
		await IfcValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateIfcDto, manager?: EntityManager) {
		await IfcValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await IfcValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async list(dto: ListIfcsDto) {
		return await this.dataSource.query(LIST_SQL, [dto.chart_ids, dto.period_id, TYPE_CODES.ENTITY_TYPE.COURSE]);
	}
}

const LIST_SQL = `
SELECT
	c.id::int                                          AS chart_id,
	ac.code                                            AS course_code,
	ac.name                                            AS course_name,
	c_program.level_title                              AS program_label,
	u.id::int                                          AS coordinator_user_id,
	u.first_name || ' ' || u.last_name                 AS coordinator_name,
	CASE WHEN i.id IS NULL THEN NULL ELSE jsonb_build_object(
		'id',           i.id,
		'information',  i.information,
		'extra',        i.extra,
		'created_at',   i.created_at,
		'updated_at',   i.updated_at,
		'status_code',  ifc_st.code,
		'status_label', ifc_st.name
	) END                                              AS ifc
FROM organization.charts c
JOIN core.types ct_entity            ON ct_entity.id = c.entity_type_id
JOIN academic.courses ac             ON ac.id = c.entity_code
JOIN organization.staff st           ON st.id = c.staff_id
JOIN organization.users u            ON u.id = st.user_id
JOIN organization.charts c_sub       ON c_sub.id     = c.root_chart_detail_id
JOIN organization.charts c_area      ON c_area.id    = c_sub.root_chart_detail_id
JOIN organization.charts c_program   ON c_program.id = c_area.root_chart_detail_id
LEFT JOIN evidence.ifcs i
	ON  i.course_id          = ac.id
	AND i.academic_period_id = $2
LEFT JOIN LATERAL (
	SELECT status_type_id
	FROM ifc.statuses
	WHERE ifc_id = i.id
	ORDER BY register_at DESC
	LIMIT 1
) latest_status ON true
LEFT JOIN core.types ifc_st          ON ifc_st.id = latest_status.status_type_id
WHERE c.id = ANY($1::int[])
  AND ct_entity.code = $3
ORDER BY c.id
`;
