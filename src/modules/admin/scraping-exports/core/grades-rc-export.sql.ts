// Banner writes non-numeric qualification statuses ("SAN", "RET", "NR") into the grade field
// itself, so a grade value is only a grade when it parses as a number.
const NUMERIC_GRADE_PATTERN = String.raw`^-?[0-9]+(\.[0-9]+)?$`;

// Both scrapers can be re-run, so a period has several runs. Only finished ones are exportable:
// without this filter a 'running' or 'failed' run wins on started_at and silently produces a
// half-empty Excel.
const EXPORTABLE_RUN_STATUSES = `('completed', 'partial')`;

// Banner + Planner cross, merge, grade-type resolution and last-grade fallback, in one pass. Both
// scrapings live in the same physical DB, so nothing is joined in Node; everything the main DB
// owns (TG205, TG404, the per-section designated grade type) is injected as parallel arrays.
//
// $1 period code | $2/$3 TG205 names/codes | $4/$5 TG404 names/codes
// $6/$7 section codes / designated grade type codes | $8 ASISTIO code | $9 SAN code
export const GRADES_RC_SQL = `
WITH banner_run AS (
	SELECT id FROM scrape_run
	WHERE ($1::text IS NULL OR periodo = $1)
	  AND status IN ${EXPORTABLE_RUN_STATUSES}
	ORDER BY started_at DESC
	LIMIT 1
),
planner_run AS (
	SELECT id FROM planner_scrape_run
	WHERE ($1::text IS NULL OR periodo = $1)
	  AND status IN ${EXPORTABLE_RUN_STATUSES}
	ORDER BY started_at DESC
	LIMIT 1
),
banner_grades AS (
	SELECT
		rn.codigo_alumno        AS student_code,
		rn.curso_codigo         AS course_code,
		UPPER(TRIM(n->>'tipo')) AS raw_type,
		n->>'peso'              AS weight,
		TRIM(n->>'nota')        AS grade_raw,
		CASE WHEN n->>'numero' ~ '^[0-9]+$' THEN (n->>'numero')::int END AS order_no,
		false                   AS is_sanctioned,
		rn.scraped_at           AS scraped_at
	FROM raw_notas rn
	CROSS JOIN LATERAL jsonb_array_elements(
		CASE WHEN jsonb_typeof(rn.payload->'detalle'->'notas') = 'array'
			THEN rn.payload->'detalle'->'notas'
			ELSE '[]'::jsonb
		END
	) AS n
	WHERE rn.run_id = (SELECT id FROM banner_run)
	  AND NULLIF(TRIM(n->>'tipo'), '') IS NOT NULL
),
-- raw_notas carries no NRC: the section is reached student -> matrícula -> horario, inside the
-- same Banner run. A student can only be enrolled in one section of a given course per period,
-- so the (student, course) match is unambiguous.
banner_sections AS (
	SELECT DISTINCT
		m.codigo_alumno,
		h.nrc,
		(h.payload->'materia'->>'codigo') || (h.payload->>'numeroCurso') AS course_code
	FROM raw_matricula m
	JOIN raw_horario h ON h.run_id = m.run_id AND h.nrc = m.nrc
	WHERE m.run_id = (SELECT id FROM banner_run)
	  AND NULLIF(TRIM(m.codigo_alumno), '') IS NOT NULL
	  AND NULLIF(TRIM(m.nrc), '') IS NOT NULL
),
banner_legs AS (
	SELECT
		bs.nrc AS section_code,
		bg.student_code,
		bg.raw_type,
		bg.weight,
		bg.grade_raw,
		bg.order_no,
		bg.is_sanctioned,
		bg.scraped_at
	FROM banner_grades bg
	JOIN banner_sections bs
	  ON bs.codigo_alumno = bg.student_code
	 AND bs.course_code   = bg.course_code
),
-- The nota -> evaluación key is matched by eval_component_id first and, when that misses, by
-- evaluation name within the section: the id correspondence is what the Planner payloads suggest
-- but has not been confirmed against a real run yet.
planner_legs AS (
	SELECT
		s.payload->>'sectionNumber'                                    AS section_code,
		n.student_code                                                 AS student_code,
		UPPER(TRIM(ev.payload->>'evalComponentCode'))                  AS raw_type,
		COALESCE(ev.payload->>'percentage', ev.payload->>'weight')     AS weight,
		TRIM(COALESCE(n.payload->>'gradeFormat', n.payload->>'grade')) AS grade_raw,
		CASE WHEN ev.payload->>'orderEvaluation' ~ '^[0-9]+$'
			THEN (ev.payload->>'orderEvaluation')::int
		END                                                            AS order_no,
		COALESCE(n.payload->>'isSanctioned', '0') NOT IN ('0', 'false') AS is_sanctioned,
		n.scraped_at                                                   AS scraped_at
	FROM raw_planner_nota n
	JOIN raw_planner_seccion s
	  ON s.run_id = n.run_id
	 AND s.section_id = n.section_id
	LEFT JOIN raw_planner_evaluacion e_id
	  ON e_id.run_id = n.run_id
	 AND e_id.eval_component_id = n.component_id
	LEFT JOIN raw_planner_evaluacion e_nm
	  ON e_id.id IS NULL
	 AND e_nm.run_id = n.run_id
	 AND e_nm.section_id = n.section_id
	 AND e_nm.payload->>'evalComponentName' = n.payload->>'evaluation'
	CROSS JOIN LATERAL (SELECT COALESCE(e_id.payload, e_nm.payload) AS payload) ev
	WHERE n.run_id = (SELECT id FROM planner_run)
	  AND ev.payload IS NOT NULL
	  -- Drop the computed "Nota Final": it is a formula over the other components, not a grade.
	  AND COALESCE(n.payload->>'isFinal', '0') IN ('0', 'false')
	  AND COALESCE(ev.payload->>'isFinal', '0') IN ('0', 'false')
	  -- Drop ungraded evaluations, but keep sanctioned students: a null grade with isSanctioned
	  -- is real information (it becomes grade 0 + SAN below).
	  AND (n.payload->>'grade' IS NOT NULL
	       OR COALESCE(n.payload->>'isSanctioned', '0') NOT IN ('0', 'false'))
	  AND NULLIF(TRIM(s.payload->>'sectionNumber'), '')      IS NOT NULL
	  AND NULLIF(TRIM(n.student_code), '')                   IS NOT NULL
	  AND NULLIF(TRIM(ev.payload->>'evalComponentCode'), '') IS NOT NULL
),
-- Each source contributes what it has; when both hold the same grade the most recent scrape wins.
merged AS (
	SELECT DISTINCT ON (section_code, student_code, raw_type)
		section_code, student_code, raw_type, weight, grade_raw, order_no, is_sanctioned, scraped_at
	FROM (
		SELECT section_code, student_code, raw_type, weight, grade_raw, order_no, is_sanctioned, scraped_at
		FROM banner_legs
		UNION ALL
		SELECT section_code, student_code, raw_type, weight, grade_raw, order_no, is_sanctioned, scraped_at
		FROM planner_legs
	) u
	ORDER BY section_code, student_code, raw_type, scraped_at DESC
),
grade_types AS (SELECT * FROM unnest($2::text[], $3::text[]) AS t(name, code)),
qual_status AS (SELECT * FROM unnest($4::text[], $5::text[]) AS t(name, code)),
-- One row per section: a course can be designated by several study plans of the period, and the
-- section must not be duplicated by the join below.
designated AS (
	SELECT section_code, array_agg(grade_type_code) AS grade_type_codes
	FROM unnest($6::text[], $7::text[]) AS t(section_code, grade_type_code)
	GROUP BY section_code
),
resolved AS (
	SELECT
		m.*,
		gt.code AS grade_type_code,
		COALESCE(m.grade_raw ~ '${NUMERIC_GRADE_PATTERN}', false) AS is_numeric
	FROM merged m
	LEFT JOIN grade_types gt ON gt.name = m.raw_type
),
-- The RC semaphore reads a single grade per enrollment: the one whose type is the course's
-- designated type. When the merged grades hold no such type the last evaluation is rescued with
-- its own raw code, so the student is never left without a grade for the section.
flagged AS (
	SELECT
		r.*,
		bool_or(COALESCE(r.grade_type_code = ANY(d.grade_type_codes), false))
			OVER (PARTITION BY r.section_code, r.student_code) AS has_designated,
		row_number() OVER (
			PARTITION BY r.section_code, r.student_code
			ORDER BY r.order_no DESC NULLS LAST, r.raw_type DESC
		) AS last_rank
	FROM resolved r
	LEFT JOIN designated d ON d.section_code = r.section_code
)
SELECT
	f.section_code                          AS "sectionCode",
	f.student_code                          AS "studentCode",
	COALESCE(f.grade_type_code, f.raw_type) AS "gradeTypeCode",
	f.weight                                AS "gradeTypePercentage",
	CASE WHEN f.is_numeric AND NOT f.is_sanctioned THEN f.grade_raw ELSE '0' END AS "grade",
	CASE
		WHEN f.is_sanctioned THEN $9::text
		WHEN f.is_numeric    THEN $8::text
		ELSE COALESCE(qs.code, f.grade_raw, '')
	END                                     AS "qualificationStatusCode"
FROM flagged f
LEFT JOIN qual_status qs ON qs.name = UPPER(f.grade_raw)
WHERE f.grade_type_code IS NOT NULL
   OR (NOT f.has_designated AND f.last_rank = 1)
ORDER BY f.section_code, f.student_code, f.raw_type
`;

// Query the main DB runs against academic.course_sections: the grade type designated for a
// section's course, which is what the RC semaphore looks up per enrollment.
export const DESIGNATED_GRADE_TYPES_SQL = `
SELECT DISTINCT
	cs.section_code AS "sectionCode",
	t.code          AS "gradeTypeCode"
FROM academic.course_sections cs
JOIN academic.study_plan_courses spc
	ON spc.course_id = cs.course_id
JOIN academic.study_plan_academic_periods spap
	ON spap.id = spc.study_plan_academic_period_id
	AND spap.academic_period_id = cs.academic_period_id
JOIN core.types t
	ON t.id = (spc.extra->>'grade_type_id')::int
WHERE cs.academic_period_id = $1::int
  AND spc.extra ? 'grade_type_id'
`;
