import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import type { I18nText } from 'src/shared/types/i18n';

export interface ScopeRow {
	id: number;
	parentId: number | null;
	levelNum: number;
	typeCode: string;
	label: I18nText;
	isAnchor: boolean;
}

export interface UserSchoolRow {
	id: number;
	code: string;
	name: I18nText;
	facultyId: number;
	facultyCode: string | null;
	facultyName: I18nText | null;
}

@Injectable()
export class OrgScopeRepository {
	constructor(private readonly dataSource: DataSource) {}

	async findScope(userId: number, schoolId: number, periodId: number): Promise<ScopeRow[]> {
		return await this.dataSource.query(SCOPE_SQL, [
			userId,
			schoolId,
			periodId,
			TYPE_CODES.CHART_LEVEL_TYPE.SCHOOL_DIRECTOR,
		]);
	}

	async findUserSchools(
		userId: number,
		modalityCode: string,
		isAdmin: boolean,
	): Promise<UserSchoolRow[]> {
		if (isAdmin) {
			return await this.dataSource.query(ALL_SCHOOLS_SQL);
		}
		return await this.dataSource.query(USER_SCHOOLS_SQL, [
			userId,
			modalityCode,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
		]);
	}
}

const USER_SCHOOLS_SQL = `
WITH RECURSIVE
active_period AS (
	SELECT ap.id AS academic_period_id
	FROM academic.academic_periods ap
	JOIN core.types mt ON mt.id = ap.modality_type_id
	WHERE ap.is_active = true
	  AND mt.code = $2
	ORDER BY ap.start_date DESC, ap.end_date DESC, ap.id DESC
	LIMIT 1
),
user_anchors AS (
	SELECT DISTINCT
		c.id,
		c.root_chart_id,
		c.level_type_id,
		c.entity_type_id,
		c.entity_code,
		ARRAY[c.id] AS path,
		0 AS depth
	FROM organization.charts c
	JOIN organization.staff s ON s.id = c.staff_id
	JOIN active_period ap ON ap.academic_period_id = c.academic_period_id
	WHERE s.user_id   = $1
	  AND s.is_active = true
	  AND c.is_active = true
),
ancestors AS (
	SELECT
		ua.id,
		ua.root_chart_id,
		ua.level_type_id,
		ua.entity_type_id,
		ua.entity_code,
		ua.path,
		ua.depth
	FROM user_anchors ua
	UNION ALL
	SELECT
		parent.id,
		parent.root_chart_id,
		parent.level_type_id,
		parent.entity_type_id,
		parent.entity_code,
		anc.path || parent.id,
		anc.depth + 1
	FROM organization.charts parent
	JOIN ancestors anc ON parent.id = anc.root_chart_id
	JOIN active_period ap ON ap.academic_period_id = parent.academic_period_id
	WHERE parent.is_active = true
	  AND anc.depth        < 20
	  AND NOT parent.id = ANY(anc.path)
)
SELECT DISTINCT
	sc.id::int         AS "id",
	sc.code            AS "code",
	sc.name            AS "name",
	sc.faculty_id::int AS "facultyId",
	f.code             AS "facultyCode",
	f.name             AS "facultyName"
FROM ancestors s
JOIN core.types et_school  ON et_school.id  = s.entity_type_id AND et_school.code = $3
JOIN organization.schools sc ON sc.id = s.entity_code
LEFT JOIN organization.faculties f ON f.id = sc.faculty_id
WHERE sc.is_active = true
ORDER BY sc.code ASC
`;

const ALL_SCHOOLS_SQL = `
SELECT DISTINCT
	sc.id::int         AS "id",
	sc.code            AS "code",
	sc.name            AS "name",
	sc.faculty_id::int AS "facultyId",
	f.code             AS "facultyCode",
	f.name             AS "facultyName"
FROM organization.schools sc
LEFT JOIN organization.faculties f ON f.id = sc.faculty_id
WHERE sc.is_active = true
ORDER BY sc.code ASC
`;

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
