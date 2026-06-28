import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import type { I18nText } from 'src/shared/types/i18n';

export interface ScopeRow {
	id: number;
	entityId: number | null;
	parentId: number | null;
	levelNum: number;
	tagCode: string | null;
	tagName: I18nText | null;
	label: I18nText;
	isAnchor: boolean;
}

@Injectable()
export class OrgScopeRepository {
	constructor(private readonly dataSource: DataSource) {}

	async findScope(userId: number, schoolId: number, periodId: number): Promise<ScopeRow[]> {
		return await this.dataSource.query(SCOPE_SQL, [
			userId,
			schoolId,
			periodId,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
		]);
	}
}

// Hierarchy depth comes from the parent chain (root_chart_id), not a level type. The school node
// is the anchor at depth 0 (identified by entity_type = School); everything below carries its depth.
// "tag" is an optional display label (entity type) — null for generic nodes — joined LEFT so an
// untagged node is never dropped.
const SCOPE_SQL = `
WITH RECURSIVE
school_root AS (
	SELECT c.id
	FROM organization.charts c
	JOIN core.types et ON et.id = c.entity_type_id
	WHERE et.code              = $4
	  AND c.entity_code        = $2
	  AND c.academic_period_id = $3
	  AND c.is_active          = true
	LIMIT 1
),
school_subtree AS (
	SELECT c.id, c.root_chart_id, 0 AS depth
	FROM organization.charts c JOIN school_root sr ON c.id = sr.id
	UNION ALL
	SELECT c.id, c.root_chart_id, st.depth + 1
	FROM organization.charts c
	JOIN school_subtree st ON c.root_chart_id = st.id
	WHERE st.depth < 20 AND c.is_active = true
),
user_anchors AS (
	SELECT st.id
	FROM school_subtree st
	JOIN organization.charts c ON c.id        = st.id
	JOIN organization.staff s  ON s.id        = c.staff_id
	WHERE s.user_id            = $1
	  AND c.academic_period_id = $3
	  AND c.is_active          = true
),
anchors AS (
	SELECT id FROM user_anchors
	UNION
	SELECT sr.id FROM school_root sr
	WHERE NOT EXISTS (SELECT 1 FROM user_anchors)
),
ancestors AS (
	SELECT c.id, c.root_chart_id, 0 AS depth
	FROM organization.charts c JOIN anchors a ON c.id = a.id
	UNION ALL
	SELECT c.id, c.root_chart_id, anc.depth + 1
	FROM organization.charts c JOIN ancestors anc ON c.id = anc.root_chart_id
	WHERE anc.depth < 20
),
descendants AS (
	SELECT c.id, c.root_chart_id, 0 AS depth
	FROM organization.charts c JOIN anchors a ON c.id = a.id
	UNION ALL
	SELECT c.id, c.root_chart_id, d.depth + 1
	FROM organization.charts c JOIN descendants d ON c.root_chart_id = d.id
	WHERE d.depth < 20
),
scope AS (
	SELECT DISTINCT id FROM (SELECT id FROM ancestors UNION SELECT id FROM descendants) combined
)
SELECT
	c.id::int                                          AS "id",
	c.entity_code::int                                 AS "entityId",
	c.root_chart_id::int                               AS "parentId",
	st.depth                                           AS "levelNum",
	et.code                                            AS "tagCode",
	et.name                                            AS "tagName",
	c.title                                            AS "label",
	EXISTS(SELECT 1 FROM anchors a WHERE a.id = c.id)  AS "isAnchor"
FROM scope s
JOIN organization.charts c ON c.id = s.id
JOIN school_subtree st     ON st.id = s.id
LEFT JOIN core.types et    ON et.id = c.entity_type_id
ORDER BY st.depth ASC, c.id ASC
`;
