import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import type { I18nText } from 'src/shared/types/i18n';

interface ScopeRow {
	id: number;
	parentId: number | null;
	levelNum: number;
	typeCode: string;
	label: I18nText;
	isAnchor: boolean;
}

@Injectable()
export class OrgScopeService {
	constructor(private readonly dataSource: DataSource) {}

	async getScope(userId: number, schoolId: number | null, periodId: number) {
		if (schoolId === null || schoolId === undefined) {
			return { highestLevel: null, levels: [] };
		}

		const rows: ScopeRow[] = await this.dataSource.query(SCOPE_SQL, [
			userId,
			schoolId,
			periodId,
			TYPE_CODES.CHART_LEVEL_TYPE.SCHOOL_DIRECTOR,
		]);

		if (rows.length === 0) return { highestLevel: null, levels: [] };

		const byLevel = new Map<number, { typeCode: string; options: any[] }>();
		for (const r of rows) {
			const entry = byLevel.get(r.levelNum) ?? { typeCode: r.typeCode, options: [] };
			entry.options.push({ id: r.id, label: r.label, parentId: r.parentId });
			byLevel.set(r.levelNum, entry);
		}

		const anchorLevels = rows.filter((r) => r.isAnchor).map((r) => r.levelNum);
		const highestLevel = anchorLevels.length ? Math.min(...anchorLevels) : null;

		const levels = [...byLevel.entries()]
			.sort(([a], [b]) => a - b)
			.map(([levelNum, v]) => ({ levelNum, typeCode: v.typeCode, options: v.options }));

		return { highestLevel, levels };
	}
}

const SCOPE_SQL = `
WITH RECURSIVE
school_root AS (
	SELECT c.id
	FROM organization.charts c
	JOIN core.types ct ON ct.id = c.level_type_id
	WHERE ct.code              = $4
	  AND c.entity_code        = $2
	  AND c.academic_period_id = $3
	  AND c.is_active          = true
	LIMIT 1
),
school_subtree AS (
	SELECT c.id, 0 AS depth FROM organization.charts c JOIN school_root sr ON c.id = sr.id
	UNION ALL
	SELECT c.id, st.depth + 1 FROM organization.charts c JOIN school_subtree st ON c.root_chart_id = st.id WHERE st.depth < 20
),
user_anchors AS (
	SELECT c.id
	FROM organization.charts c
	JOIN school_subtree st     ON c.id        = st.id
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
	SELECT c.id, c.root_chart_id, c.level_type_id, c.title, 0 AS depth
	FROM organization.charts c
	JOIN anchors a ON c.id = a.id
	UNION ALL
	SELECT c.id, c.root_chart_id, c.level_type_id, c.title, anc.depth + 1
	FROM organization.charts c
	JOIN ancestors anc ON c.id = anc.root_chart_id
	WHERE anc.depth < 20
),
descendants AS (
	SELECT c.id, c.root_chart_id, c.level_type_id, c.title, 0 AS depth
	FROM organization.charts c
	JOIN anchors a ON c.id = a.id
	UNION ALL
	SELECT c.id, c.root_chart_id, c.level_type_id, c.title, d.depth + 1
	FROM organization.charts c
	JOIN descendants d ON c.root_chart_id = d.id
	WHERE d.depth < 20
),
scope AS (
	SELECT DISTINCT id, root_chart_id, level_type_id, title
	FROM (SELECT * FROM ancestors UNION SELECT * FROM descendants) combined
)
SELECT
	s.id::int                                           AS "id",
	s.root_chart_id::int                         AS "parentId",
	(ct.extra->>'level')::int                           AS "levelNum",
	ct.code                                             AS "typeCode",
	s.title                                       AS "label",
	EXISTS(SELECT 1 FROM anchors a WHERE a.id = s.id)   AS "isAnchor"
FROM scope s
JOIN core.types ct               ON ct.id = s.level_type_id
ORDER BY "levelNum" ASC, s.id ASC
`;
