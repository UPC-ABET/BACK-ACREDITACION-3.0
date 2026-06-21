export const RESOLVE_CONTEXT_SQL = `
WITH RECURSIVE course_chart AS (
	SELECT c.id, c.staff_id, c.entity_code AS course_id, c.root_chart_id
	FROM organization.charts c
	JOIN core.types ct                ON ct.id = c.entity_type_id
	WHERE c.id        = $1
	  AND ct.code     = $4
	  AND c.academic_period_id = $2
	  AND c.is_active = true
	LIMIT 1
),
school_walk AS (
	SELECT cc.root_chart_id AS id, 1 AS depth
	FROM course_chart cc

	UNION ALL

	SELECT c.root_chart_id, sw.depth + 1
	FROM organization.charts c
	JOIN school_walk sw ON c.id = sw.id
	WHERE c.is_active = true AND sw.depth < 20
),
school_chart AS (
	SELECT c.entity_code AS school_id
	FROM school_walk sw
	JOIN organization.charts c  ON c.id = sw.id
	JOIN core.types ct          ON ct.id = c.entity_type_id
	WHERE ct.code = $6
	LIMIT 1
)
SELECT
	cc.id::int                                                                            AS "courseChartId",
	(SELECT school_id FROM school_chart)::int                                             AS "schoolId",
	$2::int                                                                               AS "periodId",
	(SELECT id::int FROM core.types WHERE code = $3)                                      AS "triggerTypeId",
	(SELECT id::int FROM core.types WHERE code = $5)                                      AS "ifcStatusTypeId",
	(SELECT i.id::int FROM evidence.ifcs i WHERE i.course_id = cc.course_id AND i.academic_period_id = $2 LIMIT 1) AS "ifcId",
	(SELECT ap.code FROM academic.academic_periods ap WHERE ap.id = $2)                   AS "periodCode",
	(SELECT ac.name FROM academic.courses ac WHERE ac.id = cc.course_id)                  AS "courseName",
	(SELECT u.first_name || ' ' || u.last_name
		 FROM organization.staff s JOIN organization.users u ON u.id = s.user_id
		 WHERE s.id = cc.staff_id)                                                        AS "coordinatorName"
FROM course_chart cc
`;

export const LOAD_CONFIG_SQL = `
SELECT
	nc.id::int                     AS "id",
	nc.email_template_id::int      AS "emailTemplateId",
	et.subject                     AS "subject",
	et.body                        AS "body",
	nc.to_chart_entity_type_ids     AS "toChartEntityTypeIds",
	nc.cc_chart_entity_type_ids     AS "ccChartEntityTypeIds"
FROM ifc.notification_configs nc
JOIN core.email_templates et ON et.id = nc.email_template_id
WHERE nc.trigger_type_id    = $1
  AND nc.ifc_status_type_id = $2
  AND nc.is_active          = true
LIMIT 1
`;

export const RESOLVE_RECIPIENTS_SQL = `
WITH RECURSIVE chain_up AS (
	SELECT c.id, c.root_chart_id, c.entity_type_id, c.staff_id, 1 AS depth
	FROM organization.charts c
	WHERE c.id = $1 AND c.is_active = true

	UNION ALL

	SELECT c.id, c.root_chart_id, c.entity_type_id, c.staff_id, cu.depth + 1
	FROM organization.charts c
	JOIN chain_up cu ON c.id = cu.root_chart_id
	WHERE c.is_active = true AND cu.depth < 20
)
SELECT cu.entity_type_id::int AS "entityTypeId", s.id::int AS "staffId",
	COALESCE(u.email, s.staff_email) AS "staffEmail"
FROM chain_up cu
JOIN organization.staff s         ON s.id  = cu.staff_id
LEFT JOIN organization.users u    ON u.id  = s.user_id
WHERE cu.entity_type_id = ANY($2::int[])
  AND COALESCE(u.email, s.staff_email) IS NOT NULL
`;

export const LATEST_STATUS_USER_NAME_SQL = `
SELECT u.first_name || ' ' || u.last_name AS "name"
FROM ifc.statuses s
JOIN core.types t              ON t.id = s.status_type_id
LEFT JOIN organization.staff st ON st.id = s.staff_id
LEFT JOIN organization.users u  ON u.id = st.user_id
WHERE s.ifc_id = $1 AND t.code = $2
ORDER BY s.register_at DESC
LIMIT 1
`;

export const LATEST_STATUS_COMMENT_SQL = `
SELECT s.comment AS "comment"
FROM ifc.statuses s
JOIN core.types t ON t.id = s.status_type_id
WHERE s.ifc_id = $1 AND t.code = $2
ORDER BY s.register_at DESC
LIMIT 1
`;
