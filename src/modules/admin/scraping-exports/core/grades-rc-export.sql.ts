// IF YOU CHANGE GRADES_RC_SQL, RUN `test/manual/grades-rc-export.verify.ts`.
//
// Nothing runs it for you: it is not a .spec.ts, jest only collects those under src/, and CI does
// not call it. The jest suite around this file mocks `query`, so it can assert which parameters are
// passed and nothing about what the SQL does with them -- the merge, the newest-scrape-wins rule,
// the dedup, the designated/fallback pick and the status classification are all in this string, and
// that script is the only thing that executes it. Its header says how to point it at a throwaway
// Postgres; it refuses to touch anything else.
import { GRADE_RC_OBSERVATIONS } from '../model/scraping-exports.types';

// Banner writes non-numeric qualification statuses ("SAN", "RET", "NR") into the grade field
// itself, so a grade value is only a grade when it parses as a number.
const NUMERIC_GRADE_PATTERN = String.raw`^-?[0-9]+(\.[0-9]+)?$`;

// Both scrapers can be re-run, so a period has several runs and only the newest is read. That makes
// the status filter load-bearing: 'running' and 'failed' runs are obviously unusable, but 'partial'
// is excluded too, and deliberately. A partial run is one that was scoped to a subset (a single
// school, a course list) or died halfway, so it can hold FEWER rows than the complete run before it
// -- and since only one run is read, letting it win on started_at would silently drop everything it
// did not cover. Falling back to the last complete run trades freshness for a whole export.
const EXPORTABLE_RUN_STATUSES = `('completed')`;

// Planner marks a grade of exactly 0 with markType 'CAL' to say the zero is a real, awarded grade
// rather than the default value of a still-ungraded evaluation. Measured against the data: CAL
// appears only on zeros, and Banner independently reports 0 for 97.6% of the rows that match. So a
// CAL zero counts as attended -- it must NOT become a qualification status, or the RC semaphore
// would drop it (it ignores every grade whose status is not ASISTIO).
const VERIFIED_ZERO_MARK = `'CAL'`;

// Banner + Planner cross, merge, grade-type resolution and last-grade fallback, in one pass. Both
// scrapings live in the same physical DB, so nothing is joined in Node; everything the main DB
// owns (TG205, TG404, the per-section designated grade type) is injected as parallel arrays.
//
// $1 period code | $2/$3 TG205 names/codes | $4/$5 TG404 names/codes
// $6/$7 section codes / designated grade type codes | $8 ASISTIO code | $9 SAN code
// $10 section codes loaded in academic.course_sections for the period | $11 RET code
// $12/$13 the (section, student) pairs enrolled in the period (academic.student_section_enrollments)
// $14/$15 Banner program codes / career codes (PROGRAM_CAREER_MAP)
// ($9 and $11 are the course-level statuses -- see the classified CTE.)
export const GRADES_RC_SQL = `
WITH grade_types AS (SELECT * FROM unnest($2::text[], $3::text[]) AS t(name, code)),
-- Banner program code -> career code (PROGRAM_CAREER_MAP). Injected rather than resolved in Node so
-- the whole row is shaped in one pass, like the two type catalogs above.
--
-- Unlike the matriculados export, a program missing from the map does NOT drop the row: this is a
-- grades export, and losing a student's grade because their program is outside the accreditation
-- scope would silently shorten the file. The career simply comes out empty.
careers AS (SELECT * FROM unnest($14::text[], $15::text[]) AS t(program_code, career_code)),
-- Declared before the legs on purpose: Planner's status fields are whitelisted against this
-- catalog rather than passed through. Measured against the data, markType also carries the literal
-- string "null" (2,871 rows, most of them with a real grade) and 'CAL'; passing either on would
-- make audit.fn_upload_grades_rc auto-provision it as a permanent TG404 type. Resolving through
-- TG404 keeps 'RET'/'NR' -- the only real statuses Planner emits -- and drops the rest.
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
		-- Banner has no separate status field: a non-numeric grade IS the status, so status_text is
		-- derived from grade_raw downstream rather than carried here.
		NULL::text              AS status_raw,
		(NULLIF(TRIM(n->>'nota'), '') IS NOT NULL) AS has_grade,
		-- Banner has no equivalent of Planner's CAL mark and no notion of an open evaluation: a grade
		-- that is in the payload is a grade that was recorded.
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
-- raw_notas carries no NRC: the section is reached student -> matrícula -> horario, inside the
-- same Banner run. A student can only be enrolled in one section of a given course per period,
-- so the (student, course) match is unambiguous.
--
-- Deliberately NOT filtered on calificable='Y'. A Banner course is split across NRCs (theory +
-- practice/lab) and the student is enrolled in all of them, but which one counts is decided by
-- academic.course_sections, not by Banner: the data load already keeps only the gradeable section
-- per course. Two competing rules would let this one silently drop a section the app deliberately
-- loaded, so the collapse below defers to the app instead.
banner_sections AS (
	SELECT DISTINCT
		m.codigo_alumno,
		h.nrc,
		(h.payload->'materia'->>'codigo') || (h.payload->>'numeroCurso') AS course_code,
		-- materia is Banner's SUBJECT AREA ("1ASI" -> "COMPUTACIÓN"), not the course, so none of its
		-- keys names the course. nombreCurso is the only plausible one left and is still unconfirmed;
		-- Planner's courseName is preferred over it in the merged CTE.
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
-- The nota -> evaluación key is matched by eval_component_id first and, when that misses, by
-- evaluation name within the section: the id correspondence is what the Planner payloads suggest
-- but has not been confirmed against a real run yet.
planner_raw AS (
	SELECT
		s.payload->>'sectionNumber'                                    AS section_code,
		n.student_code                                                 AS student_code,
		UPPER(TRIM(ev.payload->>'evalComponentCode'))                  AS raw_type,
		COALESCE(ev.payload->>'percentage', ev.payload->>'weight')     AS weight,
		TRIM(COALESCE(n.payload->>'gradeFormat', n.payload->>'grade')) AS grade_raw,
		-- Whitelisted through TG404: statusName only ever holds 'RET' and markType only 'NR' (plus
		-- the noise this drops). isSanctioned is folded in as a third source even though the scrape
		-- shows it always 0 -- it is the documented flag for SAN, so honouring it costs nothing if
		-- Planner starts setting it. DPI is NOT derivable here: isDpi, inInvestigation and every
		-- attendance counter are 0 across all 2.4M rows.
		COALESCE(
			(SELECT q.name FROM qual_status q WHERE q.name = UPPER(TRIM(n.payload->>'statusName'))),
			(SELECT q.name FROM qual_status q WHERE q.name = UPPER(TRIM(n.payload->>'markType'))),
			CASE WHEN COALESCE(n.payload->>'isSanctioned', '0') NOT IN ('0', 'false')
				THEN (SELECT q.name FROM qual_status q WHERE q.code = $9)
			END
		)                                                              AS status_raw,
		(n.payload->>'grade' IS NOT NULL)                              AS has_grade,
		(UPPER(TRIM(COALESCE(n.payload->>'markType', ''))) = ${VERIFIED_ZERO_MARK}) AS zero_verified,
		-- An evaluation that is not submitted is still open: a grade missing from it is pending, not
		-- an absence. Kept so the two can be told apart in the observations.
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
		-- Planner carries no program: the career is filled from the Banner leg by the window in
		-- merged, exactly as the student name is.
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
-- Keep a row when it carries a grade or a status that survived the whitelist. An evaluation that is
-- both ungraded and silent says nothing; one that is ungraded but says RET/NR is the evidence for
-- explaining a student who is missing the course's designated grade.
planner_legs AS (
	SELECT section_code, student_code, raw_type, weight, grade_raw, status_raw, has_grade,
		zero_verified, is_submitted, order_no, scraped_at, course_code, course_name, student_name,
		program_code, source
	FROM planner_raw
	WHERE has_grade OR status_raw IS NOT NULL
),
-- Each source contributes what it has; when both hold the same grade the most recent scrape wins.
-- A row that carries an actual grade beats one that only carries a status, whatever the timestamps:
-- an absence is not a competing value, so it must never displace a real grade.
--
-- Course and student names are filled across sources with a window before the row is picked: the
-- winning row may come from the source that lacks a name (Banner's course name in particular), and
-- the descriptive sheet should still show it. Window functions run before DISTINCT ON, so the
-- surviving row already carries the filled value.
merged AS (
	SELECT DISTINCT ON (section_code, student_code, raw_type)
		section_code, student_code, raw_type, weight, grade_raw, status_raw, has_grade, zero_verified,
		is_submitted, order_no, scraped_at, source,
		max(course_code) OVER (PARTITION BY section_code) AS course_code,
		-- Planner names the course ("Taller de Proyecto II"); Banner's materia is the subject area
		-- ("COMPUTACIÓN"), which is why its name is only a fallback rather than a max() across both.
		COALESCE(
			max(course_name) FILTER (WHERE source = 'Planner') OVER (PARTITION BY section_code),
			max(course_name) FILTER (WHERE source = 'Banner')  OVER (PARTITION BY section_code)
		) AS course_name,
		max(student_name) OVER (PARTITION BY student_code) AS student_name,
		max(program_code) OVER (PARTITION BY student_code) AS program_code
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
	-- Scoped to the sections the app knows, and scoped HERE so everything downstream -- the name
	-- backfill windows, the collapse, the per-section designated lookup -- only ever sees rows that
	-- can actually be exported. A grade whose section is not in academic.course_sections has nowhere
	-- to land: audit.fn_upload_grades_rc rejects it with sectionNotFound and, being all-or-nothing,
	-- discards the whole file with it.
	WHERE u.section_code = ANY($10::text[])
	ORDER BY section_code, student_code, raw_type, has_grade DESC, scraped_at DESC
),
-- Banner splits a course across NRCs (theory + practice/lab) and enrols the student in all of them;
-- Planner mirrors the same split, so the same grade can arrive under several sections. The scope
-- filter above already dropped the ones the app never loaded, which resolves the split in almost
-- every case -- the data load keeps a single gradeable section per course. This collapse is the
-- backstop for a course that somehow kept two loaded sections for the same student, and enforces
-- the same invariant as the alumno-sección export ("un alumno una vez por curso").
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
		COALESCE(m.grade_raw ~ '${NUMERIC_GRADE_PATTERN}', false) AS is_numeric,
		CASE WHEN m.grade_raw ~ '${NUMERIC_GRADE_PATTERN}' THEN m.grade_raw::numeric = 0 ELSE false END
			AS is_zero,
		-- One status text per row regardless of source: Planner's whitelisted field when it has one,
		-- else Banner's non-numeric grade (which Banner writes in the grade field itself).
		COALESCE(
			m.status_raw,
			CASE WHEN NOT COALESCE(m.grade_raw ~ '${NUMERIC_GRADE_PATTERN}', false)
				THEN NULLIF(TRIM(m.grade_raw), '')
			END
		) AS status_text
	FROM deduped m
	LEFT JOIN grade_types gt ON gt.name = m.raw_type
),
-- Statuses do not all have the same reach, and treating them alike is how a status gets invented.
--  - COURSE level (RET, SAN): withdrawing from or being sanctioned in a course applies to every one
--    of its evaluations, so it legitimately explains an evaluation the student has no row for. The
--    data backs it: all 204,130 RET rows carry no grade on ANY evaluation.
--  - EVALUATION level (NR): "no rindió" is a fact about ONE evaluation. Borrowing the NR of PC1 to
--    explain a missing DD1 asserts something the source never said, so it is never propagated.
classified AS (
	SELECT
		r.*,
		qs.code AS status_code,
		qs.name AS status_name,
		COALESCE(qs.code IN ($9::text, $11::text), false) AS status_is_course_level
	FROM resolved r
	LEFT JOIN qual_status qs ON qs.name = UPPER(r.status_text)
),
-- The designated type is picked ONCE per section, here, and code/name/weight are read from that
-- single row. Doing it with three separate max() windows would pick per expression rather than per
-- row: a section designated by two study plans with different types would export the greater code
-- alongside the weight of the other type, and fn_upload_grades_rc writes that weight into
-- student_course_grades.grade_type_percentage -- the RC computation would then run on a weight
-- belonging to a different evaluation. (max() on weight is also a TEXT max, where '5' beats '20'.)
-- The pick is ordered by grade type code purely to be deterministic.
section_designated AS (
	SELECT DISTINCT ON (r.section_code)
		r.section_code,
		r.grade_type_code AS designated_code,
		r.raw_type        AS designated_name,
		r.weight          AS designated_weight
	FROM classified r
	JOIN designated d ON d.section_code = r.section_code
	WHERE r.grade_type_code = ANY(d.grade_type_codes)
	-- student_code only breaks the tie between several students' rows of the SAME type: the weight is
	-- a property of the evaluation, so they carry the same one, but the pick still has to be stable.
	ORDER BY r.section_code, r.grade_type_code, r.student_code
),
-- The RC semaphore reads a single grade per enrollment: the one whose type is the course's
-- designated type. So this export emits AT MOST ONE row per (section, student) -- never every
-- scraped grade.
--
-- Which one, decided per SECTION (the course), never per student:
--  - the section holds grades of the designated type -> that grade is the one exported. A student
--    who lacks it does NOT fall back to another grade; instead the row is emitted against the
--    designated type with grade 0 and whatever status explains the absence.
--  - the section holds no grade of that type at all (the course is not evaluated that way, or no
--    designated type is configured) -> only then does every student fall back to their last
--    evaluation, kept with its own raw code.
--
-- pick_rank sorts designated grades first, then by evaluation order descending, so rank 1 is the
-- designated grade when the student has one and their last grade otherwise -- the latter being the
-- row that gets rewritten into the "missing designated grade" shape below.
--
-- The per-student window carries the evidence for that rewrite, and only course-level statuses are
-- allowed into it -- see the classified CTE.
flagged AS (
	SELECT
		r.*,
		COALESCE(r.grade_type_code = ANY(d.grade_type_codes), false) AS is_designated,
		(sd.designated_code IS NOT NULL) AS section_has_designated,
		sd.designated_code,
		sd.designated_name,
		sd.designated_weight,
		-- Whether the designated evaluation is closed is a fact about the evaluation, not about one
		-- student, so it stays an aggregate -- but over the type that was actually picked.
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
	FROM classified r
	LEFT JOIN designated d ON d.section_code = r.section_code
	LEFT JOIN section_designated sd ON sd.section_code = r.section_code
),
shaped AS (
	SELECT
		f.*,
		-- The section is evaluated with the designated type but this student has no such grade.
		(f.section_has_designated AND NOT f.is_designated) AS missing_designated,
		-- For a missing designated grade the picked row belongs to a DIFFERENT evaluation, so its own
		-- status says nothing about the missing one: only a course-level status may explain it.
		-- Otherwise the row is the student's own evaluation and its status stands, with the
		-- course-level one as a backstop.
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
-- The (section, student) pairs the app has enrolled. audit.fn_upload_grades_rc refuses the whole
-- file when a row's student is unknown (studentNotFound) or not enrolled in its section
-- (enrollmentNotFound), and a student can only be missing here, never wrong: the pair either exists
-- or it does not. So the pairs are injected and anti-joined once, rather than checked per row.
enrolled AS (
	SELECT DISTINCT section_code, student_code
	FROM unnest($12::text[], $13::text[]) AS t(section_code, student_code)
),
-- The exported status is settled here rather than in the SELECT so the observations can key off the
-- value that actually ships, instead of re-deriving it and drifting from it.
final AS (
	SELECT
		s.*,
		(e.student_code IS NULL) AS not_enrolled,
		CASE
			WHEN s.missing_designated THEN COALESCE(s.explained_status_code, '')
			-- A zero Planner marked as awarded (CAL) is a real grade: attended, scored 0. Anything
			-- else that is a plain zero yields to a status when one exists.
			WHEN s.is_numeric AND s.is_zero AND NOT s.zero_verified
				THEN COALESCE(s.explained_status_code, $8::text)
			WHEN s.is_numeric THEN $8::text
			-- Non-numeric and not a known TG404 status: the raw text ships as-is rather than being
			-- dropped. fn_upload_grades_rc auto-provisions an unrecognized status code, so passing it
			-- through is what lets the row load; emptying it would hit qualificationStatusEmpty and
			-- refuse the whole file over a status the source actually stated.
			ELSE COALESCE(s.explained_status_code, s.status_text, '')
		END AS final_status_code,
		CASE
			WHEN s.missing_designated THEN COALESCE(s.explained_status_name, '')
			WHEN s.is_numeric AND s.is_zero AND NOT s.zero_verified
				THEN COALESCE(s.explained_status_name, (SELECT name FROM qual_status WHERE code = $8), '')
			WHEN s.is_numeric
				THEN COALESCE((SELECT name FROM qual_status WHERE code = $8), '')
			ELSE COALESCE(s.explained_status_name, s.status_text, '')
		END AS final_status_name
	FROM shaped s
	LEFT JOIN enrolled e
	  ON e.section_code = s.section_code
	 AND e.student_code = s.student_code
)
-- The first six columns are the upload template, in order, and nothing may be inserted among them:
-- the RC bulk upload parses positionally. Everything after them is descriptive only and feeds the
-- second worksheet, which the upload never reads (it parses worksheets[0]).
--
-- A missing designated grade with no explanation deliberately ships an EMPTY status: the upload
-- rejects it with qualificationStatusEmpty and, being all-or-nothing, refuses the file. That is the
-- intended behaviour -- the export cannot invent a reason, and a human has to look at it before any
-- of these grades land.
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
		-- A course-level status settles the row on its own: the 0 comes from the withdrawal or the
		-- sanction, not from the evaluation that happened to be picked. Saying "the last grade was
		-- taken" alongside it reads as if the 0 had been earned, so that observation is suppressed.
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
		-- The exported code is the raw scraped one: the row resolved through no TG205 type, which is
		-- exactly what the upload rejects as gradeTypeInvalid. Only reachable on a fallback row (a
		-- designated row resolved through TG205 by definition), but keyed off the code that actually
		-- ships rather than off the fallback, since the fallback often rescues a KNOWN type and those
		-- rows upload fine.
		CASE WHEN NOT s.missing_designated AND s.grade_type_code IS NULL
			THEN '${GRADE_RC_OBSERVATIONS.UNREGISTERED_GRADE_TYPE}' END,
		CASE WHEN s.not_enrolled
			THEN '${GRADE_RC_OBSERVATIONS.STUDENT_NOT_ENROLLED}' END
	], NULL) AS "observations"
FROM final s
LEFT JOIN careers c ON c.program_code = s.program_code
ORDER BY s.section_code, s.student_code
`;

// Sections the app actually knows for the period. The RC upload validates every row against this
// table and discards the whole file on the first miss, so the export uses it to decide which grades
// can go into the upload sheet -- and, before that, which section a course's grade belongs to when
// the scrape carries several (theory + practice/lab).
export const UPLOADED_SECTIONS_SQL = `
SELECT section_code AS "sectionCode"
FROM academic.course_sections
WHERE academic_period_id = $1::int
`;

// Name of the per-session scratch table the export is read from. TEMP, so it is scoped to the one
// connection that creates it and cannot collide with anything else; still dropped explicitly,
// because a pooled connection outlives the request that borrowed it.
export const GRADES_RC_TEMP_TABLE = 'grades_rc_export_rows';

// The merge above, run ONCE into a scratch table that both worksheets are then paged out of.
//
// Two problems this solves at the same time. The rows used to be materialized in Node -- a full
// period at once, in an API capped at 640 MB -- and paging the merge itself instead would have
// re-run 400+ lines of cross-scrape merge per page. Materializing once and paging over the result
// is a cheap sequential scan, so memory stops scaling with the period and the merge still runs
// once. It also dissolves the two-worksheet problem: a result set can only be streamed once, but a
// table can be read twice.
//
// "exportSeq" is the paging key: ORDER BY is stated explicitly rather than inherited from the inner
// query, since a subquery's ordering is not guaranteed to survive. It reproduces the same order the
// merge ends on, so the sheets keep their sort.
export const MATERIALIZE_GRADES_RC_SQL = `
CREATE TEMP TABLE ${GRADES_RC_TEMP_TABLE} AS
SELECT row_number() OVER (ORDER BY q."sectionCode", q."studentCode") AS "exportSeq", q.*
FROM (${GRADES_RC_SQL}) q
`;

// Keyset, not OFFSET: with an index on "exportSeq" each page is an index scan from where the last
// one stopped, instead of re-scanning and re-sorting the whole table once per page.
export const INDEX_GRADES_RC_TEMP_SQL = `
CREATE INDEX "IDX_${GRADES_RC_TEMP_TABLE}_export_seq" ON ${GRADES_RC_TEMP_TABLE} ("exportSeq")
`;

export const READ_GRADES_RC_PAGE_SQL = `
SELECT * FROM ${GRADES_RC_TEMP_TABLE}
WHERE "exportSeq" > $1::bigint
ORDER BY "exportSeq"
LIMIT $2::int
`;

// The enrollments the app has for the period, in the same shape audit.fn_upload_grades_rc checks
// them: a row whose (section, student) pair is missing here is rejected as enrollmentNotFound (or
// studentNotFound, which this subsumes -- a student absent from academic.students has no enrollment
// either), and the rejection discards the whole file. The export cannot fix it, so it flags it.
//
// Aggregated into two arrays by the database rather than returned row by row: these are the two
// parallel arrays the merge takes as $12/$13, and a period's worth of enrollments returned as rows
// would be hundreds of thousands of throwaway objects built only to be flattened. COALESCE because
// array_agg over no rows yields NULL, and a NULL there would mark EVERY student as not enrolled.
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
-- The ::int cast is guarded by a CASE, not by the WHERE: the "extra ? key" test below only proves
-- the key exists, not that it holds a number, and Postgres is free to evaluate the join before the
-- filter. A single row holding the type CODE instead of its id ("TG205-T002" -- an easy slip when
-- this is set by hand) would otherwise abort the whole export with a cast error. CASE guarantees
-- the cast runs only on the branch that already matched digits.
JOIN core.types t
	ON t.id = CASE
		WHEN spc.extra->>'grade_type_id' ~ '^[0-9]+$'
		THEN (spc.extra->>'grade_type_id')::int
	END
WHERE cs.academic_period_id = $1::int
  AND spc.extra ? 'grade_type_id'
`;
