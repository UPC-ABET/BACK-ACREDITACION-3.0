// IF YOU CHANGE GRADES_RC_SQL, RUN `test/manual/grades-rc-export.verify.ts` -- nothing runs it for
// you, and the jest suite mocks `query`, so nothing else executes this SQL.
import { GRADE_RC_OBSERVATIONS } from '../model/scraping-exports.types';

// Non-matches fall through to candidates's status_text as unstructured status text instead.
const NUMERIC_GRADE_PATTERN = String.raw`^-?[0-9]+(\.[0-9]+)?$`;

// 'partial' is excluded on purpose: a run scoped to one school or cut short holds FEWER rows than
// the complete one before it, and only the newest run is read.
const EXPORTABLE_RUN_STATUSES = `('completed')`;

// Planner marks an awarded zero with markType 'CAL', to tell it from the default 0 of a still
// ungraded evaluation. It must not become a status: the RC semaphore drops anything not ASISTIO.
// Historically measured against the data (while this query still had a Banner leg): CAL appears
// only on zeros, and Banner independently reported 0 for 97.6% of the rows that matched.
const VERIFIED_ZERO_MARK = `'CAL'`;

// $1 period code | $2/$3 TG205 names/codes | $4/$5 TG404 names/codes
// $6/$7 section codes / designated grade type codes | $8 ASISTIO code | $9 SAN code
// $10 the export's section scope: loaded in academic.course_sections AND carrying a CONTROL
// outcome, already intersected by the repository | $11 RET code
// $12/$13 the (section, student) pairs enrolled IN THAT SECTION (academic.student_section_enrollments)
// $14/$15 Banner program codes / career codes (PROGRAM_CAREER_MAP)
// $16 NR code, shipped when the student has no grade: not ASISTIO, so the semaphore leaves those
// zeros out of the RC average.
// $17 student codes enrolled in the PERIOD at all (academic.enrolled_students), broader than $12/$13
// ($9 and $11 are the course-level statuses -- see the classified CTE.)
//
// No $18/$19: the study-plan rescue is no longer a parameter pair here -- see `period_enrolled`.
//
// $10 is applied where the sections are read (scoped_planner_sections), not as a filter bolted on
// afterwards -- a second scope array on the same column, applied later, was enough to stop Postgres
// pushing the predicate down at all once (back when this query also had a Banner leg to scope the
// same way) -- the export then ran forever in production. Filtering at the source keeps the scope
// part of the plan instead of a hint.
export const GRADES_RC_SQL = `
WITH grade_types AS (SELECT * FROM unnest($2::text[], $3::text[]) AS t(name, code)),
-- A program outside the map does NOT drop the row, unlike the matriculados export: the career just
-- comes out empty rather than the grade going missing.
careers AS (SELECT * FROM unnest($14::text[], $15::text[]) AS t(program_code, career_code)),
-- Declared before the legs: Planner's status fields are whitelisted against this catalog rather
-- than passed through. markType also carries 'CAL' and the literal string "null" (2,871 rows, most
-- of them with a real grade), and fn_upload_grades_rc would auto-provision either as a permanent
-- TG404 type.
qual_status AS (SELECT * FROM unnest($4::text[], $5::text[]) AS t(name, code)),
-- Kept only to scope program_lookup below -- the grades leg that used to read from it
-- (banner_grades/banner_sections/banner_legs) was retired in favor of Planner alone; see
-- ADR-005.
banner_run AS (
	SELECT id FROM scrape_run
	WHERE ($1::text IS NULL OR period = $1)
	  AND status IN ${EXPORTABLE_RUN_STATUSES}
	ORDER BY started_at DESC
	LIMIT 1
),
planner_run AS (
	SELECT id FROM planner_scrape_run
	WHERE ($1::text IS NULL OR period = $1)
	  AND status IN ${EXPORTABLE_RUN_STATUSES}
	ORDER BY started_at DESC
	LIMIT 1
),
-- programCode -> careerCode no longer rides through the grades merge (it used to be backfilled
-- from banner_legs via a window function over every row for a student, so a Planner-only row
-- could inherit a Banner-only row's value). Resolved directly, once per student, independent of
-- which source has grade rows for them.
program_lookup AS (
	SELECT
		student_code,
		NULLIF(TRIM(payload->'programa'->>'codigo'), '') AS program_code
	FROM raw_alumno
	WHERE run_id = (SELECT id FROM banner_run)
),
-- Resolved up front so planner_raw can filter nota.section_id directly -- filtering seccion.payload
-- after the join left Postgres scanning every nota row before discarding ~80% as out of scope.
scoped_planner_sections AS (
	SELECT section_id
	FROM raw_planner_seccion
	WHERE run_id = (SELECT id FROM planner_run)
	  AND payload->>'sectionNumber' = ANY($10::text[])
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
		'Planner'::text                                                AS source
	FROM raw_planner_nota n
	JOIN raw_planner_seccion s
	  ON s.run_id = n.run_id
	 AND s.section_id = n.section_id
	LEFT JOIN raw_planner_evaluacion e_id
	  ON e_id.run_id = n.run_id
	 AND e_id.eval_component_id = n.component_id
	-- e_nm as a scalar subquery, not a second LEFT JOIN: COALESCE short-circuits, so this only runs
	-- when e_id misses. e_id stays a real JOIN -- it can match >1 row on (run_id, eval_component_id)
	-- alone, and a LIMIT 1 subquery would silently collapse that fan-out instead of preserving it.
	CROSS JOIN LATERAL (
		SELECT COALESCE(
			e_id.payload,
			(SELECT e_nm.payload
			 FROM raw_planner_evaluacion e_nm
			 WHERE e_nm.run_id = n.run_id
			   AND e_nm.section_id = n.section_id
			   AND e_nm.payload->>'evalComponentName' = n.payload->>'evaluation'
			 LIMIT 1)
		) AS payload
	) ev
	WHERE n.run_id = (SELECT id FROM planner_run)
	  -- section_id, not seccion.payload -- pushes onto IDX_raw_planner_nota_section_id. The old
	  -- NULLIF/TRIM check on sectionNumber is redundant: scoped_planner_sections already required it.
	  AND n.section_id = ANY(ARRAY(SELECT section_id FROM scoped_planner_sections))
	  AND ev.payload IS NOT NULL
	  -- Drop the computed "Nota Final": it is a formula over the other components, not a grade.
	  AND COALESCE(n.payload->>'isFinal', '0') IN ('0', 'false')
	  AND COALESCE(ev.payload->>'isFinal', '0') IN ('0', 'false')
	  AND NULLIF(TRIM(n.student_code), '')                   IS NOT NULL
	  AND NULLIF(TRIM(ev.payload->>'evalComponentCode'), '') IS NOT NULL
),
-- An ungraded evaluation is kept only when it says why: that is the evidence for explaining a
-- missing designated grade.
planner_legs AS (
	SELECT section_code, student_code, raw_type, weight, grade_raw, status_raw, has_grade,
		zero_verified, is_submitted, order_no, scraped_at, course_code, course_name, student_name,
		source
	FROM planner_raw
	WHERE has_grade OR status_raw IS NOT NULL
),
-- Planner's rows, with the status resolved BEFORE the merge: which row wins depends on the
-- status's reach, so it cannot be classified afterwards.
--
-- Already scoped to $10, so every window and collapse downstream only sees exportable rows. Two
-- things ride on that array, and neither is reported as an observation because a row outside it
-- has nowhere to go: a section absent from academic.course_sections would make
-- audit.fn_upload_grades_rc reject the whole file, and a course with no CONTROL outcome (TG302-T002)
-- mapped in the period's study plan is never read by the RC semaphore.
candidates AS (
	SELECT
		u.*,
		COALESCE(u.grade_raw ~ '${NUMERIC_GRADE_PATTERN}', false) AS is_numeric,
		-- One status text per row: Planner's whitelisted status field, else its own non-numeric grade.
		COALESCE(
			u.status_raw,
			CASE WHEN NOT COALESCE(u.grade_raw ~ '${NUMERIC_GRADE_PATTERN}', false)
				THEN NULLIF(TRIM(u.grade_raw), '')
			END
		) AS status_text
	FROM planner_legs u
),
-- Statuses do not all have the same reach, and treating them alike is how a status gets invented.
--  - COURSE level (RET, SAN): withdrawing from or being sanctioned in a course applies to every one
--    of its evaluations, so it legitimately explains an evaluation the student has no row for. The
--    data backs it: all 204,130 RET rows carry no grade on ANY evaluation.
--  - EVALUATION level (NR): "no rindió" is a fact about ONE evaluation. Borrowing the NR of PC1 to
--    explain a missing DD1 asserts something the source never said, so it is never propagated.
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
--  3. any value at all, so a stated status does not lose to a blank scraped later;
--  4. anything else.
--
-- The name/career windows run before DISTINCT ON, so the surviving row carries values backfilled
-- from the source that had them.
merged AS (
	SELECT DISTINCT ON (section_code, student_code, raw_type)
		section_code, student_code, raw_type, weight, grade_raw, status_raw, has_grade, zero_verified,
		is_submitted, order_no, scraped_at, source, is_numeric, status_text, status_code, status_name,
		status_is_course_level,
		max(course_code) OVER (PARTITION BY section_code) AS course_code,
		max(course_name) OVER (PARTITION BY section_code) AS course_name,
		max(student_name) OVER (PARTITION BY student_code) AS student_name
	FROM classified
	ORDER BY section_code, student_code, raw_type,
		status_is_course_level DESC, is_numeric DESC, has_grade DESC, scraped_at DESC
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
--
-- MATERIALIZED: referenced once, so Postgres (PG12+) auto-inlines it by default -- and with every
-- unnest($n::text[])-based CTE here misestimated at rows=1, an inlined re-run looks free to the
-- planner. It isn't: unmaterialized, this was a Nested Loop re-running this CTE 320,025 times
-- (25m of a 26.5m query). See openGradesRcExport's enable_nestloop for the rest of the fix.
section_designated AS MATERIALIZED (
	SELECT DISTINCT ON (r.section_code)
		r.section_code,
		r.grade_type_code AS designated_code,
		r.raw_type        AS designated_name,
		r.weight          AS designated_weight
	FROM resolved r
	JOIN designated d ON d.section_code = r.section_code
	WHERE r.grade_type_code = ANY(d.grade_type_codes)
	-- student_code only breaks the tie between several students' rows of the SAME type: the weight is
	-- a property of the evaluation, so they carry the same one, but the pick still has to be stable.
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
-- period_enrolled (matriculado) is a hard scope, dropped below like $10's section scopes. Missing
-- enrolled (paired to THIS section) only flags the row (not_in_section) here. Whether the course is
-- on the student's study plan is checked in a SEPARATE pass after this query, by
-- ScrapingExportsRepository.resolveInStudyPlanRescues: that join, run unscoped against every student
-- sharing a study-plan cohort, fanned out to 7M+ rows for a real period and OOM'd the process. Scoped
-- instead to just the notInSection rows this query actually produces, it stays a cheap indexed
-- lookup -- see STUDY_PLAN_MEMBERSHIP_FOR_PAIRS_SQL.
period_enrolled AS (
	SELECT DISTINCT student_code
	FROM unnest($17::text[]) AS t(student_code)
),
enrolled AS (
	SELECT DISTINCT section_code, student_code
	FROM unnest($12::text[], $13::text[]) AS t(section_code, student_code)
),
final AS (
	SELECT
		s.*,
		(e.student_code IS NULL) AS not_in_section,
		CASE
			WHEN s.missing_designated THEN COALESCE(s.explained_status_code, $16::text)
			-- A plain zero yields to a status when one exists; a CAL zero is an awarded grade.
			WHEN s.is_numeric AND s.is_zero AND NOT s.zero_verified
				THEN COALESCE(s.explained_status_code, $8::text)
			WHEN s.is_numeric THEN $8::text
			-- Unrecognized status text ships as-is: the upload auto-provisions it, while emptying it
			-- would refuse the file over a status the source actually stated.
			ELSE COALESCE(s.explained_status_code, s.status_text, $16::text)
		END AS final_status_code,
		CASE
			WHEN s.missing_designated
				THEN COALESCE(s.explained_status_name, (SELECT name FROM qual_status WHERE code = $16), '')
			WHEN s.is_numeric AND s.is_zero AND NOT s.zero_verified
				THEN COALESCE(s.explained_status_name, (SELECT name FROM qual_status WHERE code = $8), '')
			WHEN s.is_numeric
				THEN COALESCE((SELECT name FROM qual_status WHERE code = $8), '')
			ELSE COALESCE(s.explained_status_name, s.status_text,
				(SELECT name FROM qual_status WHERE code = $16), '')
		END AS final_status_name
	FROM shaped s
	JOIN period_enrolled pe ON pe.student_code = s.student_code
	LEFT JOIN enrolled e
	  ON e.section_code = s.section_code
	 AND e.student_code = s.student_code
	-- No study-plan filter: every matriculado row ships (see period_enrolled above).
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
		CASE WHEN s.not_in_section
			THEN '${GRADE_RC_OBSERVATIONS.STUDENT_NOT_IN_SECTION}' END,
		-- The shipped status is raw source text, resolved through no TG404 type: the upload would
		-- auto-provision it as a permanent one, so it has to be confirmed by hand first.
		CASE WHEN NOT EXISTS (SELECT 1 FROM qual_status q WHERE q.code = s.final_status_code)
			THEN '${GRADE_RC_OBSERVATIONS.UNREGISTERED_STATUS}' END,
		-- The source stated nothing at all -- no grade, no status, and no reason for either -- so the
		-- $16 default in final_status_code is this export's own guess, not something Planner said.
		-- planner_legs's WHERE (has_grade OR status_raw IS NOT NULL) still lets a blank-but-present
		-- grade through (has_grade is true whenever the grade key is non-null, even if its text is
		-- empty/whitespace), so this stays reachable; without this the row ships 0 + NR to the upload
		-- sheet and becomes a real grade for a student nobody ever graded.
		CASE WHEN NOT s.missing_designated AND NOT s.is_numeric
		          AND s.explained_status_code IS NULL AND s.status_text IS NULL
			THEN '${GRADE_RC_OBSERVATIONS.NO_SOURCE_GRADE_OR_STATUS}' END
	], NULL) AS "observations",
	-- Internal to the two-pass prune (see the comment above period_enrolled): the caller drops this
	-- column from the temp table (DROP_NOT_IN_SECTION_COLUMN_SQL) once the second pass has resolved
	-- it, so it never reaches GradeRcExportRow / rowsData.
	s.not_in_section AS "notInSection"
FROM final s
LEFT JOIN program_lookup pl ON pl.student_code = s.student_code
LEFT JOIN careers c ON c.program_code = pl.program_code
ORDER BY s.section_code, s.student_code
`;

// Sections whose course carries a CONTROL outcome (TG302-T002) in the study plan of the period --
// the same join SEMAPHORE_RC_SCREEN_SQL's course_outcome_results CTE makes, so the export ships
// exactly what the semaphore can read. Two things it deliberately inherits from that query:
//  - study_plan_courses is joined by course_id only, NOT pinned to the section's own
//    study_plan_academic_period. The semaphore itself does not pin it there either, so a course
//    keeps counting as CONTROL here even when the mapping lives on a different period's
//    study-plan row for that course. Pinning it (as an earlier version of this query did) makes
//    the export stricter than the semaphore and silently drops sections it still reports on --
//    exactly the mismatch this query exists to avoid.
//  - outcome_type_id lives on the MAPPING, not on the outcome -- an outcome can be control for one
//    course and verification (TG302-T001) for the next;
// An inactive outcome does not count, matching the semaphore's filtered_outcomes. DISTINCT because
// a course mapped to several control outcomes must not repeat its section.
export const CONTROL_OUTCOME_SECTIONS_SQL = `
SELECT DISTINCT cs.section_code AS "sectionCode"
FROM academic.course_sections cs
JOIN academic.study_plan_courses spc
	ON spc.course_id = cs.course_id
JOIN academic.course_outcome_mappings com
	ON com.study_plan_course_id = spc.id
JOIN accreditation.outcomes o
	ON o.id = com.outcome_id
	AND o.is_active = true
JOIN core.types ot
	ON ot.id = com.outcome_type_id
WHERE cs.academic_period_id = $1::int
  AND ot.code = $2::text
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
// guaranteed to survive. "hasObservations" is the worksheet split; materialized here and carried
// through to the in-memory rows array persisted via rowsData (see ADR-004), where it drives the
// download-time two-sheet read.
export const MATERIALIZE_GRADES_RC_SQL = `
CREATE TEMP TABLE ${GRADES_RC_TEMP_TABLE} AS
SELECT
	row_number() OVER (ORDER BY q."sectionCode", q."studentCode") AS "exportSeq",
	COALESCE(cardinality(q."observations"), 0) > 0                AS "hasObservations",
	q.*
FROM (${GRADES_RC_SQL}) q
`;

// Keyset, not OFFSET: each page of the single ingestion pass (READ_GRADES_RC_ALL_PAGE_SQL) is an
// index scan from where the last one stopped, instead of re-scanning and re-sorting the whole
// table once per page. No longer leads with "hasObservations" -- that split now happens in memory
// on the rowsData array this temp table is collected into (see ADR-004), not here.
export const INDEX_GRADES_RC_TEMP_SQL = `
CREATE INDEX "IDX_${GRADES_RC_TEMP_TABLE}_export_seq"
	ON ${GRADES_RC_TEMP_TABLE} ("exportSeq")
`;

// One unfiltered pass over the temp table, collected in full into the rowsData array persisted for
// this export (see ADR-004). The two-sheet split ("clean" vs "observations") happens in memory on
// that array at render time, not re-derived here.
export const READ_GRADES_RC_ALL_PAGE_SQL = `
SELECT * FROM ${GRADES_RC_TEMP_TABLE}
WHERE "exportSeq" > $1::bigint
ORDER BY "exportSeq"
LIMIT $2::int
`;

// Section pairings, aggregated into the parallel arrays $12/$13 -- row-by-row would be hundreds of
// thousands of objects. COALESCE: array_agg over no rows is NULL, which would flag every row as
// STUDENT_NOT_IN_SECTION instead of leaving `enrolled` empty. $2 is GRADES_RC_SQL's $10 scope.
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
	  AND cs.section_code = ANY($2::text[])
) pair
`;

// Period-wide matriculados ($17 in GRADES_RC_SQL), independent of section. COALESCE has the opposite
// consequence here: an empty array drops every row from the export instead of just flagging it.
export const PERIOD_ENROLLED_STUDENTS_SQL = `
SELECT DISTINCT st.code AS "studentCode"
FROM academic.enrolled_students es
JOIN academic.students st ON st.id = es.student_id
JOIN academic.study_plan_academic_periods spap ON spap.id = es.study_plan_academic_period_id
WHERE spap.academic_period_id = $1::int
`;

// Second pass of the study-plan rescue (see `period_enrolled` in GRADES_RC_SQL). Scoping the same
// join to `candidates` lets Postgres drive it off that small set instead of off
// study_plan_courses/enrolled_students, which is what turned it from a 7M-row scan into an index
// lookup.
export const STUDY_PLAN_MEMBERSHIP_FOR_PAIRS_SQL = `
WITH candidates AS (
	SELECT * FROM unnest($2::text[], $3::text[]) AS t(section_code, student_code)
)
SELECT DISTINCT cs.section_code AS "sectionCode", st.code AS "studentCode"
FROM academic.course_sections cs
JOIN academic.study_plan_courses spc ON spc.course_id = cs.course_id
JOIN academic.enrolled_students es ON es.study_plan_academic_period_id = spc.study_plan_academic_period_id
JOIN academic.students st ON st.id = es.student_id
JOIN candidates c ON c.section_code = cs.section_code AND c.student_code = st.code
WHERE cs.academic_period_id = $1::int
`;

// Every (section, student) pair GRADES_RC_SQL shipped but could not pair to the section directly --
// exactly the candidates STUDY_PLAN_MEMBERSHIP_FOR_PAIRS_SQL needs to check, and nothing broader.
export const NOT_IN_SECTION_CANDIDATES_SQL = `
SELECT DISTINCT "sectionCode", "studentCode"
FROM ${GRADES_RC_TEMP_TABLE}
WHERE "notInSection" = true
`;

// Drops every notInSection row not confirmed by STUDY_PLAN_MEMBERSHIP_FOR_PAIRS_SQL (see R5c in
// test/manual/grades-rc-export.verify.ts). $1/$2 are the matches only: NOT EXISTS over an empty
// unnest is true for every row, so an empty pair (nothing rescued) correctly prunes all of them.
export const PRUNE_GRADES_RC_UNRESOLVED_SQL = `
DELETE FROM ${GRADES_RC_TEMP_TABLE} t
WHERE t."notInSection" = true
  AND NOT EXISTS (
    SELECT 1 FROM unnest($1::text[], $2::text[]) AS m(section_code, student_code)
    WHERE m.section_code = t."sectionCode" AND m.student_code = t."studentCode"
  )
`;

// Internal bookkeeping column, dropped once the prune above has resolved every candidate -- see the
// comment on GRADES_RC_SQL's own "notInSection" output column.
export const DROP_NOT_IN_SECTION_COLUMN_SQL = `
ALTER TABLE ${GRADES_RC_TEMP_TABLE} DROP COLUMN "notInSection"
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
