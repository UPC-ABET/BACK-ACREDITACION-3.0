// IF YOU CHANGE GRADES_RC_SQL, RUN `test/manual/grades-rc-export.verify.ts` -- nothing runs it for
// you, and the jest suite mocks `query`, so nothing else executes this SQL.
import { GRADE_RC_OBSERVATIONS } from '../model/scraping-exports.types';

// Banner writes statuses ("SAN", "RET", "NR") into the grade field itself, so a value is only a
// grade when it parses as a number.
const NUMERIC_GRADE_PATTERN = String.raw`^-?[0-9]+(\.[0-9]+)?$`;

// 'partial' is excluded on purpose: a run scoped to one school or cut short holds FEWER rows than
// the complete one before it, and only the newest run is read.
const EXPORTABLE_RUN_STATUSES = `('completed')`;

// Planner marks an awarded zero with markType 'CAL', to tell it from the default 0 of a still
// ungraded evaluation. It must not become a status: the RC semaphore drops anything not ASISTIO.
const VERIFIED_ZERO_MARK = `'CAL'`;

// Shipped when the student has no grade and nothing explains why. Not a TG404 code: the upload
// auto-provisions an unrecognized status by name, so the first file carrying it registers "SN" as a
// real one -- and being anything but ASISTIO, the semaphore leaves those zeros out of the RC average.
const NO_GRADE_STATUS = `'SN'`;

// $1 period code | $2/$3 TG205 names/codes | $4/$5 TG404 names/codes
// $6/$7 section codes / designated grade type codes | $8 ASISTIO code | $9 SAN code
// $10 section codes loaded in academic.course_sections for the period | $11 RET code
// $12/$13 the (section, student) pairs enrolled in the period (academic.student_section_enrollments)
// $14/$15 Banner program codes / career codes (PROGRAM_CAREER_MAP)
// ($9 and $11 are the course-level statuses -- see the classified CTE.)
export const GRADES_RC_SQL = `
WITH grade_types AS (SELECT * FROM unnest($2::text[], $3::text[]) AS t(name, code)),
-- A program outside the map does NOT drop the row, unlike the matriculados export: the career just
-- comes out empty rather than the grade going missing.
careers AS (SELECT * FROM unnest($14::text[], $15::text[]) AS t(program_code, career_code)),
-- Declared before the legs: Planner's status fields are whitelisted against this catalog rather
-- than passed through. markType also carries 'CAL' and the literal string "null", and
-- fn_upload_grades_rc would auto-provision either as a permanent TG404 type.
qual_status AS (SELECT * FROM unnest($4::text[], $5::text[]) AS t(name, code)),
banner_run AS (
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
		-- Banner has no status field of its own; status_text is derived from grade_raw downstream.
		NULL::text              AS status_raw,
		(NULLIF(TRIM(n->>'nota'), '') IS NOT NULL) AS has_grade,
		-- No CAL equivalent and no notion of an open evaluation.
		false                   AS zero_verified,
		true                    AS is_submitted,
		CASE WHEN n->>'numero' ~ '^[0-9]+$' THEN (n->>'numero')::int END AS order_no,
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
-- raw_notas carries no NRC: the section is reached student -> matrícula -> horario within the run.
--
-- Deliberately NOT filtered on calificable='Y'. Which of a course's NRCs (theory, practice/lab)
-- counts is decided by academic.course_sections, not by Banner; a second rule here could drop a
-- section the app deliberately loaded.
banner_sections AS (
	SELECT DISTINCT
		m.codigo_alumno,
		h.nrc,
		(h.payload->'materia'->>'codigo') || (h.payload->>'numeroCurso') AS course_code,
		-- materia is the SUBJECT AREA ("1ASI" -> "COMPUTACIÓN"), not the course. nombreCurso is
		-- unconfirmed; Planner's courseName wins over it in merged.
		h.payload->>'nombreCurso' AS course_name
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
		bg.status_raw,
		bg.has_grade,
		bg.zero_verified,
		bg.is_submitted,
		bg.order_no,
		bg.scraped_at,
		bs.course_code,
		bs.course_name,
		NULLIF(TRIM(CONCAT_WS(', ', a.payload->>'apellidos', a.payload->>'nombres')), '') AS student_name,
		-- Banner's own program code ("UAC_ISOF_SP1"); resolved to the career code the rest of the
		-- system speaks ("SW") through the map injected in $14/$15.
		NULLIF(TRIM(a.payload->'programa'->>'codigo'), '') AS program_code,
		'Banner'::text AS source
	FROM banner_grades bg
	JOIN banner_sections bs
	  ON bs.codigo_alumno = bg.student_code
	 AND bs.course_code   = bg.course_code
	LEFT JOIN raw_alumno a
	  ON a.run_id = (SELECT id FROM banner_run)
	 AND a.codigo_alumno = bg.student_code
),
-- nota -> evaluación matched by eval_component_id, falling back to evaluation name within the
-- section: the id correspondence is unconfirmed against a real run.
planner_raw AS (
	SELECT
		s.payload->>'sectionNumber'                                    AS section_code,
		n.student_code                                                 AS student_code,
		UPPER(TRIM(ev.payload->>'evalComponentCode'))                  AS raw_type,
		COALESCE(ev.payload->>'percentage', ev.payload->>'weight')     AS weight,
		TRIM(COALESCE(n.payload->>'gradeFormat', n.payload->>'grade')) AS grade_raw,
		-- Whitelisted through TG404: statusName only holds 'RET', markType only 'NR'. isSanctioned is
		-- always 0 in the scrape but kept as the documented SAN flag. DPI is NOT derivable: isDpi,
		-- inInvestigation and every attendance counter are 0 across all 2.4M rows.
		COALESCE(
			(SELECT q.name FROM qual_status q WHERE q.name = UPPER(TRIM(n.payload->>'statusName'))),
			(SELECT q.name FROM qual_status q WHERE q.name = UPPER(TRIM(n.payload->>'markType'))),
			CASE WHEN COALESCE(n.payload->>'isSanctioned', '0') NOT IN ('0', 'false')
				THEN (SELECT q.name FROM qual_status q WHERE q.code = $9)
			END
		)                                                              AS status_raw,
		(n.payload->>'grade' IS NOT NULL)                              AS has_grade,
		(UPPER(TRIM(COALESCE(n.payload->>'markType', ''))) = ${VERIFIED_ZERO_MARK}) AS zero_verified,
		-- Not submitted = still open, so a grade missing from it is pending rather than an absence.
		COALESCE(ev.payload->>'isSubmitted', '0') NOT IN ('0', 'false')  AS is_submitted,
		CASE WHEN ev.payload->>'orderEvaluation' ~ '^[0-9]+$'
			THEN (ev.payload->>'orderEvaluation')::int
		END                                                            AS order_no,
		n.scraped_at                                                   AS scraped_at,
		s.payload->'courses'->0->>'courseCode'                         AS course_code,
		COALESCE(s.payload->'courses'->0->>'courseName',
		         n.payload->>'nameCourse')                             AS course_name,
		NULLIF(TRIM(CONCAT_WS(', ', n.payload->>'studentLastName',
		                            n.payload->>'studentFirstName')), '') AS student_name,
		-- No program in Planner; filled from the Banner leg by the window in merged.
		NULL::text                                                     AS program_code,
		'Planner'::text                                                AS source
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
	  AND NULLIF(TRIM(s.payload->>'sectionNumber'), '')      IS NOT NULL
	  AND NULLIF(TRIM(n.student_code), '')                   IS NOT NULL
	  AND NULLIF(TRIM(ev.payload->>'evalComponentCode'), '') IS NOT NULL
),
-- An ungraded evaluation is kept only when it says why: that is the evidence for explaining a
-- missing designated grade.
planner_legs AS (
	SELECT section_code, student_code, raw_type, weight, grade_raw, status_raw, has_grade,
		zero_verified, is_submitted, order_no, scraped_at, course_code, course_name, student_name,
		program_code, source
	FROM planner_raw
	WHERE has_grade OR status_raw IS NOT NULL
),
-- Both sources' rows, with the status resolved BEFORE the merge: which row wins depends on the
-- status's reach, so it cannot be classified afterwards.
--
-- Scoped HERE so every window and collapse downstream only sees exportable rows. A section not in
-- academic.course_sections has nowhere to land: the upload rejects the whole file over it.
candidates AS (
	SELECT
		u.*,
		COALESCE(u.grade_raw ~ '${NUMERIC_GRADE_PATTERN}', false) AS is_numeric,
		-- One status text per row: Planner's whitelisted field, else Banner's non-numeric grade.
		COALESCE(
			u.status_raw,
			CASE WHEN NOT COALESCE(u.grade_raw ~ '${NUMERIC_GRADE_PATTERN}', false)
				THEN NULLIF(TRIM(u.grade_raw), '')
			END
		) AS status_text
	FROM (
		SELECT section_code, student_code, raw_type, weight, grade_raw, status_raw, has_grade,
			zero_verified, is_submitted, order_no, scraped_at, course_code, course_name, student_name,
			program_code, source
		FROM banner_legs
		UNION ALL
		SELECT section_code, student_code, raw_type, weight, grade_raw, status_raw, has_grade,
			zero_verified, is_submitted, order_no, scraped_at, course_code, course_name, student_name,
			program_code, source
		FROM planner_legs
	) u
	WHERE u.section_code = ANY($10::text[])
),
classified AS (
	SELECT
		c.*,
		qs.code AS status_code,
		qs.name AS status_name,
		COALESCE(qs.code IN ($9::text, $11::text), false) AS status_is_course_level
	FROM candidates c
	LEFT JOIN qual_status qs ON qs.name = UPPER(c.status_text)
),
-- Precedence, then newest scrape inside each tier:
--  1. a course-level status (RET/SAN) -- withdrawing from or being sanctioned in the course
--     supersedes any grade recorded for one of its evaluations;
--  2. a numeric grade -- it beats an evaluation-level status, because "no rindió" is a claim about
--     that one evaluation and the other source holding a grade contradicts it directly;
--  3. anything else.
--
-- The name/career windows run before DISTINCT ON, so the surviving row carries values backfilled
-- from the source that had them.
merged AS (
	SELECT DISTINCT ON (section_code, student_code, raw_type)
		section_code, student_code, raw_type, weight, grade_raw, status_raw, has_grade, zero_verified,
		is_submitted, order_no, scraped_at, source, is_numeric, status_text, status_code, status_name,
		status_is_course_level,
		max(course_code) OVER (PARTITION BY section_code) AS course_code,
		-- Planner names the course; Banner's is only a fallback (its materia is the subject area).
		COALESCE(
			max(course_name) FILTER (WHERE source = 'Planner') OVER (PARTITION BY section_code),
			max(course_name) FILTER (WHERE source = 'Banner')  OVER (PARTITION BY section_code)
		) AS course_name,
		max(student_name) OVER (PARTITION BY student_code) AS student_name,
		max(program_code) OVER (PARTITION BY student_code) AS program_code
	FROM classified
	ORDER BY section_code, student_code, raw_type,
		status_is_course_level DESC, is_numeric DESC, scraped_at DESC
),
-- Backstop for a course that kept two loaded sections for the same student: one section per
-- (student, course), the same invariant the alumno-sección export enforces.
deduped AS (
	SELECT *
	FROM (
		SELECT m.*,
			dense_rank() OVER (
				PARTITION BY m.student_code, m.course_code
				ORDER BY m.section_code
			) AS section_rank
		FROM merged m
	) s
	WHERE section_rank = 1
),
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
		CASE WHEN m.grade_raw ~ '${NUMERIC_GRADE_PATTERN}' THEN m.grade_raw::numeric = 0 ELSE false END
			AS is_zero
	FROM deduped m
	LEFT JOIN grade_types gt ON gt.name = m.raw_type
),
-- DISTINCT ON, not three max() windows: those pick per expression rather than per row, so a section
-- designated by two study plans could export one type's code with the other's weight -- and that
-- weight lands in student_course_grades.grade_type_percentage. The ORDER BY is only for determinism.
section_designated AS (
	SELECT DISTINCT ON (r.section_code)
		r.section_code,
		r.grade_type_code AS designated_code,
		r.raw_type        AS designated_name,
		r.weight          AS designated_weight
	FROM resolved r
	JOIN designated d ON d.section_code = r.section_code
	WHERE r.grade_type_code = ANY(d.grade_type_codes)
	ORDER BY r.section_code, r.grade_type_code, r.student_code
),
-- At most ONE row per (section, student): the RC semaphore reads a single grade per enrollment.
-- Which one is decided per SECTION, never per student -- if the section has grades of the
-- designated type, a student lacking it gets 0 against that type rather than falling back to
-- another grade; only a section with none of that type falls back to each student's last
-- evaluation. pick_rank encodes both: rank 1 is the designated grade, or the last one.
flagged AS (
	SELECT
		r.*,
		COALESCE(r.grade_type_code = ANY(d.grade_type_codes), false) AS is_designated,
		(sd.designated_code IS NOT NULL) AS section_has_designated,
		sd.designated_code,
		sd.designated_name,
		sd.designated_weight,
		-- A fact about the evaluation, not about one student -- but over the type actually picked.
		bool_or(CASE WHEN r.grade_type_code = sd.designated_code THEN r.is_submitted END)
			OVER (PARTITION BY r.section_code) AS designated_submitted,
		max(CASE WHEN r.status_is_course_level THEN r.status_code END)
			OVER (PARTITION BY r.section_code, r.student_code) AS student_course_status_code,
		max(CASE WHEN r.status_is_course_level THEN r.status_name END)
			OVER (PARTITION BY r.section_code, r.student_code) AS student_course_status_name,
		row_number() OVER (
			PARTITION BY r.section_code, r.student_code
			ORDER BY
				COALESCE(r.grade_type_code = ANY(d.grade_type_codes), false) DESC,
				r.order_no DESC NULLS LAST,
				r.raw_type DESC
		) AS pick_rank
	FROM resolved r
	LEFT JOIN designated d ON d.section_code = r.section_code
	LEFT JOIN section_designated sd ON sd.section_code = r.section_code
),
shaped AS (
	SELECT
		f.*,
		(f.section_has_designated AND NOT f.is_designated) AS missing_designated,
		-- When the designated grade is missing the picked row is a DIFFERENT evaluation, so its own
		-- status says nothing about it: only a course-level status may explain the absence.
		CASE WHEN f.section_has_designated AND NOT f.is_designated
			THEN f.student_course_status_code
			ELSE COALESCE(f.status_code, f.student_course_status_code)
		END AS explained_status_code,
		CASE WHEN f.section_has_designated AND NOT f.is_designated
			THEN f.student_course_status_name
			ELSE COALESCE(f.status_name, f.student_course_status_name)
		END AS explained_status_name
	FROM flagged f
	WHERE f.pick_rank = 1
),
-- The (section, student) pairs the app has enrolled; the upload refuses the whole file over a row
-- that is not among them (studentNotFound / enrollmentNotFound).
enrolled AS (
	SELECT DISTINCT section_code, student_code
	FROM unnest($12::text[], $13::text[]) AS t(section_code, student_code)
),
-- Settled here, not in the SELECT, so the observations key off the value that actually ships.
final AS (
	SELECT
		s.*,
		(e.student_code IS NULL) AS not_enrolled,
		CASE
			WHEN s.missing_designated THEN COALESCE(s.explained_status_code, ${NO_GRADE_STATUS})
			-- A plain zero yields to a status when one exists; a CAL zero is an awarded grade.
			WHEN s.is_numeric AND s.is_zero AND NOT s.zero_verified
				THEN COALESCE(s.explained_status_code, $8::text)
			WHEN s.is_numeric THEN $8::text
			-- Unrecognized status text ships as-is: the upload auto-provisions it, while emptying it
			-- would refuse the file over a status the source actually stated.
			ELSE COALESCE(s.explained_status_code, s.status_text, ${NO_GRADE_STATUS})
		END AS final_status_code,
		CASE
			WHEN s.missing_designated THEN COALESCE(s.explained_status_name, ${NO_GRADE_STATUS})
			WHEN s.is_numeric AND s.is_zero AND NOT s.zero_verified
				THEN COALESCE(s.explained_status_name, (SELECT name FROM qual_status WHERE code = $8), '')
			WHEN s.is_numeric
				THEN COALESCE((SELECT name FROM qual_status WHERE code = $8), '')
			ELSE COALESCE(s.explained_status_name, s.status_text, ${NO_GRADE_STATUS})
		END AS final_status_name
	FROM shaped s
	LEFT JOIN enrolled e
	  ON e.section_code = s.section_code
	 AND e.student_code = s.student_code
)
-- The first six columns are the upload template, in order: the RC upload parses positionally, so
-- nothing may be inserted among them. The rest is descriptive and feeds the second worksheet.
SELECT
	s.section_code AS "sectionCode",
	s.student_code AS "studentCode",
	CASE WHEN s.missing_designated THEN s.designated_code
	     ELSE COALESCE(s.grade_type_code, s.raw_type)
	END AS "gradeTypeCode",
	CASE WHEN s.missing_designated THEN s.designated_weight ELSE s.weight END AS "gradeTypePercentage",
	CASE WHEN s.missing_designated OR NOT s.is_numeric THEN '0' ELSE s.grade_raw END AS "grade",
	s.final_status_code AS "qualificationStatusCode",
	COALESCE($1::text, '')       AS "academicPeriod",
	COALESCE(s.course_code, '')  AS "courseCode",
	COALESCE(s.course_name, '')  AS "courseName",
	COALESCE(s.student_name, '') AS "studentName",
	COALESCE(c.career_code, '')  AS "careerCode",
	CASE WHEN s.missing_designated THEN s.designated_name ELSE s.raw_type END AS "gradeTypeName",
	s.final_status_name AS "qualificationStatusName",
	s.source AS "source",
	to_char(s.scraped_at, 'YYYY-MM-DD HH24:MI') AS "scrapedAt",
	ARRAY_REMOVE(ARRAY[
		-- A course-level status settles the row on its own, so it suppresses the fallback note below:
		-- the 0 comes from the withdrawal, not from the evaluation that happened to be picked.
		CASE WHEN s.final_status_code IN ($9::text, $11::text)
			THEN '${GRADE_RC_OBSERVATIONS.COURSE_LEVEL_STATUS}' END,
		CASE WHEN s.missing_designated AND s.explained_status_code IS NOT NULL
			THEN '${GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE}' END,
		CASE WHEN s.missing_designated AND s.explained_status_code IS NULL
		          AND NOT COALESCE(s.designated_submitted, false)
			THEN '${GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE_PENDING}' END,
		CASE WHEN s.missing_designated AND s.explained_status_code IS NULL
		          AND COALESCE(s.designated_submitted, false)
			THEN '${GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE_UNEXPLAINED}' END,
		CASE WHEN NOT s.section_has_designated
		          AND s.final_status_code NOT IN ($9::text, $11::text)
			THEN '${GRADE_RC_OBSERVATIONS.FALLBACK_GRADE}' END,
		CASE WHEN NOT s.missing_designated AND s.is_numeric AND s.is_zero
		          AND NOT s.zero_verified AND s.explained_status_code IS NULL
			THEN '${GRADE_RC_OBSERVATIONS.ZERO_GRADE_UNEXPLAINED}' END,
		-- Raw scraped code, i.e. resolved through no TG205 type: what the upload calls
		-- gradeTypeInvalid. Keyed off the shipped code, since the fallback often rescues a known type.
		CASE WHEN NOT s.missing_designated AND s.grade_type_code IS NULL
			THEN '${GRADE_RC_OBSERVATIONS.UNREGISTERED_GRADE_TYPE}' END,
		CASE WHEN s.not_enrolled
			THEN '${GRADE_RC_OBSERVATIONS.STUDENT_NOT_ENROLLED}' END
	], NULL) AS "observations"
FROM final s
LEFT JOIN careers c ON c.program_code = s.program_code
ORDER BY s.section_code, s.student_code
`;

// Sections the app knows for the period: the hard scope of the export.
export const UPLOADED_SECTIONS_SQL = `
SELECT section_code AS "sectionCode"
FROM academic.course_sections
WHERE academic_period_id = $1::int
`;

// TEMP, so it is scoped to the connection that creates it; still dropped explicitly, because a
// pooled connection outlives the request that borrowed it.
export const GRADES_RC_TEMP_TABLE = 'grades_rc_export_rows';

// The merge run ONCE into a scratch table both worksheets are paged out of: a result set can only be
// streamed once, and paging the merge itself would re-run 400 lines of cross-scrape SQL per page.
//
// "exportSeq" restates the ORDER BY rather than inheriting it -- a subquery's ordering is not
// guaranteed to survive. "hasObservations" is the worksheet split, materialized so it can lead the
// index.
export const MATERIALIZE_GRADES_RC_SQL = `
CREATE TEMP TABLE ${GRADES_RC_TEMP_TABLE} AS
SELECT
	row_number() OVER (ORDER BY q."sectionCode", q."studentCode") AS "exportSeq",
	cardinality(q."observations") > 0                            AS "hasObservations",
	q.*
FROM (${GRADES_RC_SQL}) q
`;

// Keyset, not OFFSET: with an index on "exportSeq" each page is an index scan from where the last
// one stopped, instead of re-scanning and re-sorting the whole table once per page.
export const INDEX_GRADES_RC_TEMP_SQL = `
CREATE INDEX "IDX_${GRADES_RC_TEMP_TABLE}_export_seq"
	ON ${GRADES_RC_TEMP_TABLE} ("hasObservations", "exportSeq")
`;

// Disjoint halves: $3 false for the clean rows of the upload sheet, true for the reviewed ones.
// Filtering in Node instead would make a page yield almost nothing whenever one half dominates.
export const READ_GRADES_RC_PAGE_SQL = `
SELECT * FROM ${GRADES_RC_TEMP_TABLE}
WHERE "hasObservations" = $3::boolean
  AND "exportSeq" > $1::bigint
ORDER BY "exportSeq"
LIMIT $2::int
`;

// The period's enrollments, aggregated into the two parallel arrays the merge takes as $12/$13 --
// returned row by row they would be hundreds of thousands of objects built only to be flattened.
// COALESCE because array_agg over no rows yields NULL, which would mark EVERY student as unenrolled.
export const ENROLLED_SECTION_STUDENTS_SQL = `
SELECT
	COALESCE(array_agg(pair.section_code), '{}') AS "sectionCodes",
	COALESCE(array_agg(pair.student_code), '{}') AS "studentCodes"
FROM (
	SELECT DISTINCT cs.section_code, st.code AS student_code
	FROM academic.student_section_enrollments sse
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id
	WHERE cs.academic_period_id = $1::int
) pair
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
-- CASE, not the WHERE below, guards the cast: "extra ? key" only proves the key exists, and
-- Postgres may evaluate the join first. One row holding the CODE instead of the id ("TG205-T002",
-- an easy slip when set by hand) would otherwise abort the whole export.
JOIN core.types t
	ON t.id = CASE
		WHEN spc.extra->>'grade_type_id' ~ '^[0-9]+$'
		THEN (spc.extra->>'grade_type_id')::int
	END
WHERE cs.academic_period_id = $1::int
  AND spc.extra ? 'grade_type_id'
`;
