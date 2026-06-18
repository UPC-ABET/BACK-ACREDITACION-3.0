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
				WHERE c_sub.id             = c0.root_chart_id
				  AND ct_sch.code          = $3
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
				WHERE c_sub.id             = c0.root_chart_id
				  AND ct_sch.code          = $5
				  AND c_school.entity_code = $3
		  )
	)
),
target_charts AS (
	SELECT c.id, c.entity_code AS course_id, c.root_chart_id, c.staff_id, c.title
	FROM organization.charts c
	JOIN core.types ct ON ct.id = c.entity_type_id
	WHERE c.id        = ANY($1::int[])
	  AND ct.code     = $4
	  AND c.is_active = true
)
SELECT
	tc.title->>$6                                           AS "courseName",
	c_area.title->>$6                                       AS "areaLabel",
	c_program.title->>$6                                    AS "programLabel",
	coord_u.first_name || ' ' || coord_u.last_name          AS "coordinatorName",
	coord_u.email                                           AS "coordinatorEmail",
	coord_prof.code                                         AS "coordinatorCode",
	ifc_st.code                                             AS "statusCode"
FROM target_charts tc
JOIN organization.charts c_sub         ON c_sub.id     = tc.root_chart_id
JOIN organization.charts c_area        ON c_area.id    = c_sub.root_chart_id
JOIN organization.charts c_program     ON c_program.id = c_area.root_chart_id
LEFT JOIN organization.staff coord_st  ON coord_st.id  = tc.staff_id
LEFT JOIN organization.users coord_u   ON coord_u.id   = coord_st.user_id
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
