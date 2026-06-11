import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import type { UserSchool } from 'src/modules/organization/org-scope/core/user-schools/user-schools.types';
import type {
	UserSchoolsRepository,
	UserSchoolsScope,
} from 'src/modules/organization/org-scope/core/user-schools/user-schools.repository.interface';

@Injectable()
export class IfcSchoolsChartRepository implements UserSchoolsRepository {
	constructor(private readonly dataSource: DataSource) {}

	async findUserSchools(
		userId: number,
		scope: UserSchoolsScope,
		isAdmin: boolean,
	): Promise<UserSchool[]> {
		if (isAdmin) {
			return await this.dataSource.query(ALL_SCHOOLS_SQL);
		}
		return await this.dataSource.query(USER_SCHOOLS_BY_PERIOD_SQL, [
			userId,
			scope.academicPeriodId,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
		]);
	}
}

const USER_SCHOOLS_BY_PERIOD_SQL = `
WITH RECURSIVE
user_anchors AS (
	SELECT DISTINCT
		c.id,
		c.root_chart_id,
		c.entity_type_id,
		c.entity_code,
		ARRAY[c.id] AS path,
		0 AS depth
	FROM organization.charts c
	JOIN organization.staff s ON s.id = c.staff_id
	WHERE s.user_id   = $1
	  AND s.is_active = true
	  AND c.is_active = true
	  AND c.academic_period_id = $2
),
ancestors AS (
	SELECT ua.id, ua.root_chart_id, ua.entity_type_id, ua.entity_code, ua.path, ua.depth
	FROM user_anchors ua
	UNION ALL
	SELECT parent.id, parent.root_chart_id, parent.entity_type_id, parent.entity_code,
		anc.path || parent.id, anc.depth + 1
	FROM organization.charts parent
	JOIN ancestors anc ON parent.id = anc.root_chart_id
	WHERE parent.is_active          = true
	  AND parent.academic_period_id = $2
	  AND anc.depth                 < 20
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
