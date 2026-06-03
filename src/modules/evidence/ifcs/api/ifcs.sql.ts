export const LIST_SQL = `
SELECT
	c.id::int                                          AS "chartId",
	ac.code                                            AS "courseCode",
	ac.name                                            AS "courseName",
	c_program.title                              AS "programLabel",
	u.id::int                                          AS "coordinatorUserId",
	u.first_name || ' ' || u.last_name                 AS "coordinatorName",
	CASE WHEN i.id IS NULL THEN NULL ELSE jsonb_build_object(
		'id',          i.id,
		'information', i.information,
		'extra',       i.extra,
		'createdAt',   i.created_at,
		'updatedAt',   i.updated_at,
		'statusCode',  ifc_st.code,
		'statusLabel', ifc_st.name,
		'statusColor', ifc_st.extra->>'color'
	) END                                              AS "ifc"
FROM organization.charts c
JOIN core.types ct_entity            ON ct_entity.id = c.entity_type_id
JOIN academic.courses ac             ON ac.id = c.entity_code
JOIN organization.staff st           ON st.id = c.staff_id
JOIN organization.users u            ON u.id = st.user_id
JOIN organization.charts c_sub       ON c_sub.id     = c.root_chart_id
JOIN organization.charts c_area      ON c_area.id    = c_sub.root_chart_id
JOIN organization.charts c_program   ON c_program.id = c_area.root_chart_id
LEFT JOIN evidence.ifcs i
	ON  i.course_id          = ac.id
	AND i.academic_period_id = $2
LEFT JOIN LATERAL (
	SELECT status_type_id
	FROM ifc.statuses
	WHERE ifc_id = i.id
	ORDER BY created_at DESC
	LIMIT 1
) latest_status ON true
LEFT JOIN core.types ifc_st          ON ifc_st.id = latest_status.status_type_id
WHERE c.id = ANY($1::int[])
  AND ct_entity.code = $3
ORDER BY c.id
`;

export const HEADER_SQL = `
-- NOTE: WITH RECURSIVE is required at the top of the WITH block because chain_up is
-- self-referential. The RECURSIVE keyword applies to the whole block — the non-recursive
-- CTEs (course_chart, school_check, requester_staff) coexist under it without issue.
WITH RECURSIVE course_chart AS (
	SELECT c.*
	FROM organization.charts c
	JOIN core.types ct                ON ct.id = c.entity_type_id
	WHERE ct.code               = $3
	  AND c.academic_period_id  = (SELECT academic_period_id FROM evidence.ifcs WHERE id = $1)
	  AND c.entity_code         = (SELECT course_id          FROM evidence.ifcs WHERE id = $1)
	  AND c.is_active           = true
	LIMIT 1
),
school_check AS (
	SELECT 1
	FROM course_chart cc
	JOIN organization.charts c_sub     ON c_sub.id     = cc.root_chart_id
	JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_id
	JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
	JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_id
	JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
	WHERE ct_sch.code = $4
	  AND c_school.entity_code = $2
),
chain_up AS (
	SELECT id, root_chart_id, staff_id, 1 AS depth
	FROM organization.charts
	WHERE id = (SELECT id FROM course_chart) AND is_active = true

	UNION ALL

	SELECT c.id, c.root_chart_id, c.staff_id, cu.depth + 1
	FROM organization.charts c
	JOIN chain_up cu ON c.id = cu.root_chart_id
	WHERE c.is_active = true AND cu.depth < 20
),
requester_staff AS (
	SELECT s.id AS staff_id
	FROM organization.staff s
	WHERE s.user_id = $5
	LIMIT 1
)
SELECT
	i.id                                            AS "ifcId",
	i.course_id::int                                AS "courseId",
	i.academic_period_id::int                       AS "academicPeriodId",
	i.information,
	i.extra,
	i.created_at                                    AS "ifcCreatedAt",
	ap.code                                         AS "academicPeriodCode",
	c_program.title                           AS "programLabel",
	c_area.title                              AS "areaLabel",
	c_sub.title                               AS "subareaLabel",
	ac.code                                         AS "courseCode",
	ac.name                                         AS "courseName",
	ac.learning_outcome                             AS "courseLearningOutcome",
	coord_u.id::int                                 AS "coordinatorUserId",
	coord_prof.code                                 AS "coordinatorCode",
	coord_u.first_name || ' ' || coord_u.last_name  AS "coordinatorName",
	ifc_st.code                                     AS "statusCode",
	ifc_st.name                                     AS "statusName",
	(ifc_st.extra->>'color')                        AS "statusColor",
	latest_status.register_at                       AS "statusAt",
	latest_status.comment                           AS "statusComment",
	u_by.first_name || ' ' || u_by.last_name        AS "statusByName",
	EXISTS (
		SELECT 1
		FROM chain_up cu, requester_staff rs
		WHERE cu.staff_id = rs.staff_id
	)                                               AS "requesterInChain"
FROM evidence.ifcs i
JOIN academic.academic_periods ap ON ap.id = i.academic_period_id
JOIN academic.courses          ac ON ac.id = i.course_id
JOIN course_chart c_course        ON true
JOIN organization.charts c_sub    ON c_sub.id     = c_course.root_chart_id
JOIN organization.charts c_area   ON c_area.id    = c_sub.root_chart_id
JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
LEFT JOIN organization.staff   coord_st   ON coord_st.id   = c_course.staff_id
LEFT JOIN organization.users   coord_u    ON coord_u.id    = coord_st.user_id
LEFT JOIN academic.professors  coord_prof ON coord_prof.staff_id = coord_st.id
LEFT JOIN LATERAL (
	SELECT status_type_id, staff_id, register_at, comment
	FROM ifc.statuses
	WHERE ifc_id = i.id
	ORDER BY created_at DESC
	LIMIT 1
) latest_status ON true
LEFT JOIN core.types ifc_st         ON ifc_st.id  = latest_status.status_type_id
LEFT JOIN organization.staff st_by  ON st_by.id   = latest_status.staff_id
LEFT JOIN organization.users u_by   ON u_by.id    = st_by.user_id
WHERE i.id = $1
  AND EXISTS (SELECT 1 FROM school_check)
`;

export const FINDINGS_SQL = `
SELECT
	f.id::int                          AS "findingId",
	f.correlative                      AS "findingCorrelative",
	f.description                      AS "findingDescription",
	f.is_automatic                     AS "isAutomatic",
	(p_fnd.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || f.correlative::text  AS "findingCode",
	crit.code                          AS "criticalityCode",
	crit.name                          AS "criticalityName",
	(crit.extra->>'color')             AS "criticalityColor"
FROM ifc.ifc_findings ifc_f
JOIN improvement.findings f      ON f.id    = ifc_f.finding_id
JOIN core.types crit             ON crit.id = f.criticality_type_id
JOIN evidence.instruments inst   ON inst.id = f.instrument_id
LEFT JOIN academic.courses ac    ON ac.id   = f.course_id
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $2) p_fnd
WHERE ifc_f.ifc_id   = $1
  AND f.is_active    = true
ORDER BY f.correlative
`;

export const FINDING_OUTCOMES_SQL = `
SELECT
	fo.finding_id::int                  AS "findingId",
	o.outcome_code                      AS "outcomeCode",
	o.outcome_name                      AS "outcomeName",
	o.outcome_description               AS "outcomeDescription",
	comm.code                           AS "commissionCode",
	comm.name                           AS "commissionName"
FROM improvement.finding_outcomes fo
JOIN accreditation.outcomes o                ON o.id    = fo.outcome_id
JOIN accreditation.program_commissions pc    ON pc.id   = o.program_commission_id
JOIN accreditation.commissions comm          ON comm.id = pc.commission_id
WHERE fo.finding_id = ANY($1::int[])
ORDER BY fo.finding_id, o.outcome_code
`;

export const FINDING_ACTIONS_SQL = `
SELECT
	fa.finding_id::int                  AS "findingId",
	a.id::int                           AS "actionId",
	a.correlative                       AS "actionCorrelative",
	a.description                       AS "actionDescription",
	(p_acn.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || a.correlative::text   AS "actionCode",
	CASE WHEN fa.evidences IS NULL THEN $3 ELSE $4 END  AS "completenessCode",
	comp.name                           AS "completenessName",
	(comp.extra->>'color')              AS "completenessColor"
FROM improvement.finding_actions fa
JOIN improvement.actions  a      ON a.id    = fa.action_id
JOIN improvement.findings f      ON f.id    = fa.finding_id
JOIN evidence.instruments inst   ON inst.id = f.instrument_id
LEFT JOIN academic.courses ac    ON ac.id   = f.course_id
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $2) p_acn
LEFT JOIN core.types comp        ON comp.code = (CASE WHEN fa.evidences IS NULL THEN $3 ELSE $4 END)
WHERE fa.finding_id = ANY($1::int[])
  AND a.is_active   = true
ORDER BY fa.finding_id, a.correlative
`;

export const OUTCOME_COURSE_BY_IFC_SQL = `
SELECT
	p.code                              AS "programCode",
	p.name                              AS "programName",
	comm.code                           AS "commissionCode",
	comm.name                           AS "commissionName",
	o.outcome_code                      AS "outcomeCode",
	o.outcome_name                      AS "outcomeName",
	o.outcome_description               AS "outcomeDescription"
FROM evidence.ifcs i
JOIN academic.study_plan_courses spc           ON spc.course_id = i.course_id
JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
                                              AND spap.academic_period_id = i.academic_period_id
JOIN academic.course_outcome_mappings m        ON m.study_plan_course_id = spc.id
JOIN accreditation.outcomes o               ON o.id    = m.outcome_id
JOIN accreditation.program_commissions pc   ON pc.id   = o.program_commission_id
JOIN academic.programs p                    ON p.id    = pc.program_id
JOIN accreditation.commissions comm         ON comm.id = pc.commission_id
WHERE i.id = $1
ORDER BY p.code, comm.code, o.outcome_code
`;

export const OUTCOME_COURSE_BY_CHART_SQL = `
SELECT
	p.code                              AS "programCode",
	p.name                              AS "programName",
	comm.code                           AS "commissionCode",
	comm.name                           AS "commissionName",
	o.outcome_code                      AS "outcomeCode",
	o.outcome_name                      AS "outcomeName",
	o.outcome_description               AS "outcomeDescription"
FROM organization.charts c_course
JOIN academic.courses ac                       ON ac.id = c_course.entity_code
JOIN academic.study_plan_courses spc           ON spc.course_id = ac.id
JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
                                              AND spap.academic_period_id = c_course.academic_period_id
JOIN academic.course_outcome_mappings m        ON m.study_plan_course_id = spc.id
JOIN accreditation.outcomes o               ON o.id    = m.outcome_id
JOIN accreditation.program_commissions pc   ON pc.id   = o.program_commission_id
JOIN academic.programs p                    ON p.id    = pc.program_id
JOIN accreditation.commissions comm         ON comm.id = pc.commission_id
WHERE c_course.id = $1
ORDER BY p.code, comm.code, o.outcome_code
`;

export const TRANSITION_CONTEXT_SQL = `
WITH course_chart AS (
	SELECT c.id AS course_chart_id, c.staff_id
	FROM organization.charts c
	JOIN core.types ct                ON ct.id = c.entity_type_id
	WHERE ct.code               = $4
	  AND c.academic_period_id  = (SELECT academic_period_id FROM evidence.ifcs WHERE id = $1)
	  AND c.entity_code         = (SELECT course_id          FROM evidence.ifcs WHERE id = $1)
	  AND c.is_active           = true
	LIMIT 1
),
school_check AS (
	SELECT 1
	FROM organization.charts c
	JOIN core.types ct                ON ct.id = c.entity_type_id
	WHERE ct.code               = $4
	  AND c.academic_period_id  = (SELECT academic_period_id FROM evidence.ifcs WHERE id = $1)
	  AND c.entity_code         = (SELECT course_id          FROM evidence.ifcs WHERE id = $1)
	  AND c.is_active           = true
	  AND EXISTS (
			SELECT 1
			FROM organization.charts c_sub
			JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_id
			JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
			JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_id
			JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
			WHERE c_sub.id           = c.root_chart_id
			  AND ct_sch.code        = $5
			  AND c_school.entity_code = $2
	  )
)
SELECT
	(SELECT course_chart_id FROM course_chart)::int AS "courseChartId",
	(SELECT staff_id FROM course_chart)::int        AS "ifcCourseStaffId",
	rs.id::int                                       AS "requesterStaffId",
	ifc_st.code                                      AS "currentStatusCode"
FROM evidence.ifcs i
LEFT JOIN organization.staff rs ON rs.user_id = $3
LEFT JOIN LATERAL (
	SELECT status_type_id
	FROM ifc.statuses
	WHERE ifc_id = i.id
	ORDER BY created_at DESC
	LIMIT 1
) latest_status ON true
LEFT JOIN core.types ifc_st ON ifc_st.id = latest_status.status_type_id
WHERE i.id = $1
  AND EXISTS (SELECT 1 FROM school_check)
`;

export const INSERT_STATUS_SQL = `
WITH new_status AS (
	INSERT INTO ifc.statuses (ifc_id, status_type_id, staff_id, register_at, comment, is_active)
	SELECT $1, t.id, $3, NOW(), $4::jsonb, true
	FROM core.types t
	WHERE t.code = $2
	RETURNING id, ifc_id, status_type_id, staff_id, register_at, comment
)
SELECT
	t.code                                                   AS code,
	t.name                                                   AS name,
	ns.register_at                                           AS at,
	ns.comment                                               AS comment,
	u.first_name || ' ' || u.last_name                       AS by
FROM new_status ns
JOIN core.types t       ON t.id  = ns.status_type_id
LEFT JOIN organization.staff st ON st.id = ns.staff_id
LEFT JOIN organization.users u  ON u.id  = st.user_id
`;

export const PREFILL_HEADER_SQL = `
WITH course_chart AS (
	SELECT c.*
	FROM organization.charts c
	JOIN core.types ct                ON ct.id = c.entity_type_id
	WHERE c.id                  = $1
	  AND ct.code               = $4
	  AND c.academic_period_id  = $2
	  AND c.is_active           = true
	LIMIT 1
),
school_check AS (
	SELECT 1
	FROM course_chart cc
	JOIN organization.charts c_sub     ON c_sub.id     = cc.root_chart_id
	JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_id
	JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
	JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_id
	JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
	WHERE ct_sch.code = $5
	  AND c_school.entity_code = $3
)
SELECT
	ap.code                                         AS "academicPeriodCode",
	c_area.title                              AS "areaLabel",
	c_sub.title                               AS "subareaLabel",
	ac.id::int                                      AS "courseId",
	ac.name                                         AS "courseName",
	ac.learning_outcome                             AS "courseLearningOutcome",
	coord_u.id::int                                 AS "coordinatorUserId",
	coord_prof.code                                 AS "coordinatorCode",
	coord_u.first_name || ' ' || coord_u.last_name  AS "coordinatorName"
FROM course_chart c_course
JOIN academic.academic_periods ap   ON ap.id = c_course.academic_period_id
JOIN academic.courses          ac   ON ac.id = c_course.entity_code
JOIN organization.charts c_sub      ON c_sub.id  = c_course.root_chart_id
JOIN organization.charts c_area     ON c_area.id = c_sub.root_chart_id
LEFT JOIN organization.staff   coord_st   ON coord_st.id   = c_course.staff_id
LEFT JOIN organization.users   coord_u    ON coord_u.id    = coord_st.user_id
LEFT JOIN academic.professors  coord_prof ON coord_prof.staff_id = coord_st.id
WHERE EXISTS (SELECT 1 FROM school_check)
`;

export const CHART_RESOLUTION_SQL = `
WITH course_chart AS (
	SELECT c.*
	FROM organization.charts c
	JOIN core.types ct                ON ct.id = c.entity_type_id
	WHERE c.id                  = $1
	  AND ct.code               = $4
	  AND c.academic_period_id  = $2
	  AND c.is_active           = true
	LIMIT 1
),
school_check AS (
	SELECT 1
	FROM course_chart cc
	JOIN organization.charts c_sub     ON c_sub.id     = cc.root_chart_id
	JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_id
	JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
	JOIN organization.charts c_school  ON c_school.id  = c_program.root_chart_id
	JOIN core.types ct_sch             ON ct_sch.id    = c_school.entity_type_id
	WHERE ct_sch.code = $5
	  AND c_school.entity_code = $3
)
SELECT
	c_course.entity_code::int    AS "courseId",
	c_course.staff_id::int       AS "ifcCourseStaffId",
	c_program.entity_code::int   AS "programId",
	rs.id::int                    AS "requesterStaffId"
FROM course_chart c_course
JOIN organization.charts c_sub     ON c_sub.id     = c_course.root_chart_id
JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_id
JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
LEFT JOIN organization.staff rs    ON rs.user_id = $6
WHERE EXISTS (SELECT 1 FROM school_check)
`;

export const REPORT_CODES_SQL = `
WITH school_check AS (
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
				  AND ct_sch.code         = $3
				  AND c_school.entity_code = $2
		  )
	)
),
target_programs AS (
	SELECT DISTINCT p.code AS code
	FROM organization.charts c
	JOIN organization.charts c_sub     ON c_sub.id     = c.root_chart_id
	JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_id
	JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
	JOIN academic.programs p           ON p.id         = c_program.entity_code
	WHERE c.id = ANY($1::int[])
	  AND EXISTS (SELECT 1 FROM school_check)
)
SELECT
	(SELECT code FROM organization.schools WHERE id = $2) AS "schoolCode",
	COALESCE(ARRAY(SELECT code FROM target_programs ORDER BY code), '{}') AS "programCodes"
`;

export const STATUS_REPORT_SQL = `
WITH school_check AS (
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
),
target_charts AS (
	SELECT c.id, c.entity_code AS course_id, c.root_chart_id, c.staff_id, c.title
	FROM organization.charts c
	JOIN core.types ct                ON ct.id = c.entity_type_id
	WHERE c.id        = ANY($1::int[])
	  AND ct.code     = $4
	  AND c.is_active = true
)
SELECT
	tc.title->>$6                                     AS "courseName",
	c_area.title->>$6                                 AS "areaLabel",
	c_program.title->>$6                              AS "programLabel",
	coord_u.first_name || ' ' || coord_u.last_name          AS "coordinatorName",
	coord_u.email                                           AS "coordinatorEmail",
	coord_prof.code                                         AS "coordinatorCode",
	ifc_st.code                                             AS "statusCode"
FROM target_charts tc
JOIN organization.charts c_sub      ON c_sub.id     = tc.root_chart_id
JOIN organization.charts c_area     ON c_area.id    = c_sub.root_chart_id
JOIN organization.charts c_program  ON c_program.id = c_area.root_chart_id
LEFT JOIN organization.staff coord_st  ON coord_st.id = tc.staff_id
LEFT JOIN organization.users coord_u   ON coord_u.id  = coord_st.user_id
LEFT JOIN academic.professors coord_prof ON coord_prof.staff_id = coord_st.id
LEFT JOIN evidence.ifcs i
	ON  i.course_id          = tc.course_id
	AND i.academic_period_id = $2
LEFT JOIN LATERAL (
	SELECT status_type_id
	FROM ifc.statuses
	WHERE ifc_id = i.id
	ORDER BY created_at DESC
	LIMIT 1
) latest_status ON true
LEFT JOIN core.types ifc_st ON ifc_st.id = latest_status.status_type_id
WHERE EXISTS (SELECT 1 FROM school_check)
ORDER BY c_program.title->>$6 ASC, c_area.title->>$6 ASC, tc.title->>$6 ASC
`;

export const PROGRAM_BY_COURSE_PERIOD_SQL = `
SELECT c_program.entity_code::int AS "programId"
FROM organization.charts c_course
JOIN core.types ct                 ON ct.id = c_course.entity_type_id
JOIN organization.charts c_sub     ON c_sub.id     = c_course.root_chart_id
JOIN organization.charts c_area    ON c_area.id    = c_sub.root_chart_id
JOIN organization.charts c_program ON c_program.id = c_area.root_chart_id
WHERE c_course.entity_code        = $1
  AND c_course.academic_period_id = $2
  AND ct.code                     = $3
  AND c_course.is_active          = true
LIMIT 1
`;

// $1 = course_id, $2 = active_period_id, $3 = exclude_ifc_id (nullable),
// $4 = action prefix parameter key, $5 = PENDING type code, $6 = IMPLEMENTED type code,
// $7 = finding prefix parameter key.
export const PREVIOUS_ACTIONS_SQL = `
WITH active AS (
	SELECT year, start_date FROM academic.academic_periods WHERE id = $2
),
via_plan AS (
	SELECT DISTINCT fa.id AS finding_action_id, a.id AS action_id
	FROM improvement.plans p
	JOIN academic.academic_periods plan_ap ON plan_ap.id = p.academic_period_id
	JOIN improvement.plan_actions pa       ON pa.plan_id = p.id
	JOIN improvement.finding_actions fa    ON fa.id      = pa.finding_action_id
	JOIN improvement.findings f            ON f.id       = fa.finding_id
	JOIN improvement.actions a             ON a.id       = fa.action_id
	CROSS JOIN active
	WHERE f.course_id        = $1
	  AND plan_ap.year       = active.year
	  AND plan_ap.start_date < active.start_date
),
via_action AS (
	SELECT DISTINCT fa.id AS finding_action_id, a.id AS action_id
	FROM improvement.actions a
	JOIN academic.academic_periods action_ap ON action_ap.id = a.academic_period_id
	JOIN improvement.finding_actions fa      ON fa.action_id = a.id
	JOIN improvement.findings f              ON f.id         = fa.finding_id
	CROSS JOIN active
	WHERE f.course_id          = $1
	  AND action_ap.year       = active.year
	  AND action_ap.start_date < active.start_date
),
candidates AS (
	SELECT finding_action_id, action_id FROM via_plan
	UNION
	SELECT finding_action_id, action_id FROM via_action
)
SELECT
	a.id::int                AS "id",
	fa.id::int               AS "findingActionId",
	fa.finding_id::int       AS "findingId",
	(p_fnd.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || f.correlative::text                   AS "findingCode",
	a.correlative::int       AS "correlative",
	a.description            AS "description",
	fa.evidences             AS "evidences",
	CASE WHEN fa.evidences IS NULL THEN $5 ELSE $6 END  AS "completenessCode",
	comp.name                AS "completenessName",
	(comp.extra->>'color')   AS "completenessColor",
	(p_acn.value #>> '{}')
		|| '-' || inst.code
		|| CASE WHEN ac.code IS NOT NULL THEN '-' || ac.code ELSE '' END
		|| '-' || a.correlative::text                   AS "code",
	CASE
		WHEN EXISTS (SELECT 1 FROM via_plan vp WHERE vp.finding_action_id = fa.id AND vp.action_id = a.id)
		 AND EXISTS (SELECT 1 FROM via_action va WHERE va.finding_action_id = fa.id AND va.action_id = a.id) THEN 'both'
		WHEN EXISTS (SELECT 1 FROM via_plan vp WHERE vp.finding_action_id = fa.id AND vp.action_id = a.id) THEN 'plan'
		ELSE 'direct'
	END                      AS "source"
FROM candidates c
JOIN improvement.finding_actions fa ON fa.id = c.finding_action_id
JOIN improvement.actions a          ON a.id  = c.action_id
JOIN improvement.findings f         ON f.id  = fa.finding_id
JOIN evidence.instruments inst      ON inst.id = f.instrument_id
LEFT JOIN academic.courses ac       ON ac.id   = f.course_id
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $4) p_acn
CROSS JOIN (SELECT value FROM core.parameters WHERE code = $7) p_fnd
LEFT JOIN core.types comp           ON comp.code = (CASE WHEN fa.evidences IS NULL THEN $5 ELSE $6 END)
WHERE $3::int IS NULL
   OR NOT EXISTS (
		SELECT 1
		FROM ifc.ifc_findings ifj
		WHERE ifj.ifc_id     = $3::int
		  AND ifj.finding_id = fa.finding_id
	)
ORDER BY a.correlative ASC, fa.id ASC
`;
