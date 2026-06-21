export const LIST_FINDINGS_SQL = `
WITH course_ids AS (
	SELECT DISTINCT entity_code AS course_id
	FROM organization.charts
	WHERE id = ANY($1::int[])
	  AND is_active = true
	  AND entity_code IS NOT NULL
),
school_check AS (
	SELECT 1
	WHERE NOT EXISTS (
		SELECT 1
		FROM organization.charts c0
		WHERE c0.id = ANY($1::int[])
		  AND NOT EXISTS (
			  SELECT 1
			  FROM organization.charts c_sub
			  JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_id
			  JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
			  JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_id
			  JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
			  WHERE c_sub.id            = c0.root_chart_id
			    AND ct_sch.code         = $5
			    AND c_school.entity_code = $3
		  )
	)
)
SELECT
	f.id::int                                                   AS "id",
	ifc_f.ifc_id::int                                           AS "ifcId",
	f.course_id::int                                            AS "courseId",
	ct_crit.code                                                AS "criticalityCode",
	ct_crit.name                                                AS "criticalityName",
	(ct_crit.extra->>'color')                                   AS "criticalityColor",
	(ct_crit.extra->>'order')::int                              AS "criticalityOrder",
	(p_fnd.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || f.correlative::text                           AS "findingCode",
	ap.code                                                     AS "academicPeriodCode",
	f.description                                               AS "description"
FROM improvement.findings f
JOIN ifc.ifc_findings ifc_f         ON ifc_f.finding_id = f.id
JOIN core.types ct_crit             ON ct_crit.id = f.criticality_type_id
JOIN evidence.instruments inst      ON inst.id    = f.instrument_id
LEFT JOIN academic.courses ac       ON ac.id      = f.course_id
JOIN academic.academic_periods ap   ON ap.id      = f.academic_period_id
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $4) p_fnd
WHERE f.course_id          = ANY (SELECT course_id FROM course_ids)
  AND f.academic_period_id = $2
  AND f.is_active          = true
  AND EXISTS (SELECT 1 FROM school_check)
ORDER BY (ct_crit.extra->>'order')::int ASC, f.correlative ASC
`;

export const FINDING_HEADER_SQL = `
WITH school_check AS (
	SELECT 1
	FROM improvement.findings f
	JOIN organization.charts c_course
	  ON  c_course.entity_code        = f.course_id
	  AND c_course.academic_period_id = f.academic_period_id
	  AND c_course.is_active          = true
	JOIN organization.charts c_sub     ON c_sub.id     = c_course.root_chart_id
	JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_id
	JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
	JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_id
	JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
	WHERE f.id = $1
	  AND ct_sch.code = $4
	  AND c_school.entity_code = $2
)
SELECT
	f.id::int                                                AS "id",
	(p_fnd.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || f.correlative::text                        AS "findingCode",
	ap.code                                                  AS "academicPeriodCode",
	f.description                                            AS "description",
	ct_crit.code                                             AS "criticalityCode",
	ct_crit.name                                             AS "criticalityName",
	(ct_crit.extra->>'color')                                AS "criticalityColor"
FROM improvement.findings f
JOIN core.types ct_crit             ON ct_crit.id = f.criticality_type_id
JOIN evidence.instruments inst      ON inst.id    = f.instrument_id
LEFT JOIN academic.courses ac       ON ac.id      = f.course_id
JOIN academic.academic_periods ap   ON ap.id      = f.academic_period_id
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $3) p_fnd
WHERE f.id        = $1
  AND f.is_active = true
  AND EXISTS (SELECT 1 FROM school_check)
`;

export const FINDING_ACTIONS_SQL = `
SELECT
	a.id::int                                                AS "id",
	(p_acn.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || a.correlative::text                        AS "actionCode",
	a.description                                            AS "description",
	CASE WHEN fa.evidences IS NULL THEN $3 ELSE $4 END       AS "completenessCode",
	comp.name                                                AS "completenessName",
	(comp.extra->>'color')                                   AS "completenessColor"
FROM improvement.finding_actions fa
JOIN improvement.actions  a      ON a.id    = fa.action_id
JOIN improvement.findings f      ON f.id    = fa.finding_id
JOIN evidence.instruments inst   ON inst.id = f.instrument_id
LEFT JOIN academic.courses ac    ON ac.id   = f.course_id
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $2) p_acn
LEFT JOIN core.types comp        ON comp.code = (CASE WHEN fa.evidences IS NULL THEN $3 ELSE $4 END)
WHERE fa.finding_id = $1
  AND a.is_active   = true
ORDER BY a.correlative ASC
`;

export const FINDING_IN_SCHOOL_SQL = `
SELECT 1
FROM improvement.findings f
JOIN organization.charts c_course
  ON  c_course.entity_code        = f.course_id
  AND c_course.academic_period_id = f.academic_period_id
  AND c_course.is_active          = true
JOIN organization.charts c_sub     ON c_sub.id     = c_course.root_chart_id
JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_id
JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_id
JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
WHERE f.id              = $1
  AND ct_sch.code       = $2
  AND c_school.entity_code = $3
LIMIT 1
`;
