const CRITICAL_RED_THRESHOLD = 23;

/**
 * RV rows are read from `academic.processed_rv_grades`, which already holds the 20-point scaled
 * grade and its performance-level rank -- for the commission that was actually graded *and* for the
 * commissions derived from it through `accreditation.outcome_conversions`. Filtering by
 * `program_commission_id` (via `filtered_outcomes`) therefore returns a full report for a
 * commission nobody grades against directly, which the previous
 * `evidence.student_course_outcome_grades` read could not do: no grades existed for its outcomes.
 *
 * `rubric_ids` / `grade_type_ids` still filter through the originating evaluation, so a converted
 * row is filtered by the rubric its source grades came from.
 */
const RV_CLASSIFIED_GRADES_CTE = `
	classified_grades AS (
		SELECT
			prg.student_section_enrollment_id AS enrollment_id,
			prg.scaled_grade                  AS grade,
			prg.outcome_id                    AS outcome_id,
			prg.course_section_id             AS course_section_id,
			prg.level_rank                    AS level_rank
		FROM academic.processed_rv_grades prg
		JOIN academic.student_section_enrollments sse ON sse.id = prg.student_section_enrollment_id
		JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
		JOIN evidence.evaluations ev ON ev.id = prg.evaluation_id
		LEFT JOIN evaluation.rubrics r ON r.id = ev.rubric_id
		WHERE prg.academic_period_id = $1::int
		  AND prg.is_active = true
		  AND sse.is_active = true
		  AND es.is_active = true
		  AND ($6::int[] IS NULL OR ev.rubric_id = ANY($6::int[]))
		  AND ($7::int[] IS NULL OR r.grade_type_id = ANY($7::int[]))
	)
`;

// Unfiltered course+outcome breakdown, used by the JSON screen endpoint (no critical/representative filtering).
export const SEMAPHORE_RC_SCREEN_SQL = `
WITH course_grades AS (
	-- The RC grade is the single student_course_grades row whose grade_type_id matches the
	-- grade type designated for this course (study_plan_courses.extra.grade_type_id) -- not a
	-- weighted sum across all grade types. Rows whose qualification status isn't ASISTIO
	-- (TG404-T001) are excluded: a 0 from RET/NR/DPI/SAN is not a real grade.
	SELECT
		sse.id AS enrollment_id,
		scg.grade AS grade
	FROM academic.student_course_grades scg
	JOIN academic.student_section_enrollments sse ON sse.id = scg.student_section_enrollment_id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	JOIN academic.courses c ON c.id = cs.course_id
	JOIN academic.study_plan_courses spc ON spc.course_id = c.id
	JOIN academic.study_plan_academic_periods spap
		ON spap.id = spc.study_plan_academic_period_id
		AND spap.academic_period_id = cs.academic_period_id
	JOIN core.types qst ON qst.id = (scg.extra->>'qualification_status_type_id')::int
	WHERE cs.academic_period_id = $1::int
	  AND sse.is_active = true
	  AND es.is_active = true
	  AND scg.grade_type_id = (spc.extra->>'grade_type_id')::int
	  AND qst.code = 'TG404-T001'
),
filtered_outcomes AS (
	SELECT id, outcome_code, outcome_name
	FROM accreditation.outcomes
	WHERE is_active = true
	  AND ($5::int IS NULL OR program_commission_id = $5::int)
),
levels AS (
	SELECT
		pl.id, pl.min_score, pl.max_score,
		ROW_NUMBER() OVER (ORDER BY pl.max_score ASC) AS level_rank
	FROM academic.performance_levels pl
	JOIN core.types it ON it.id = pl.instrument_type_id
	WHERE it.code = 'TG206-T003'
	  AND pl.academic_period_id = $1::int
	  AND pl.is_active = true
),
classified_grades AS (
	SELECT
		cg.enrollment_id,
		cg.grade,
		lv.level_rank
	FROM course_grades cg
	LEFT JOIN levels lv
		ON cg.grade >= lv.min_score AND cg.grade <= lv.max_score
),
course_outcome_results AS (
	SELECT
		c.code                                                        AS course_code,
		c.name                                                        AS course_name,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.id                                                       AS campus_id,
		camp.name                                                     AS campus,
		ap.code                                                       AS academic_period_cycle,
		COUNT(DISTINCT cg.enrollment_id)                              AS total_students,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 1 THEN cg.enrollment_id END) AS students_red,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 2 THEN cg.enrollment_id END) AS students_yellow,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 3 THEN cg.enrollment_id END) AS students_green
	FROM classified_grades cg
	JOIN academic.student_section_enrollments sse ON sse.id = cg.enrollment_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	JOIN academic.courses c ON c.id = cs.course_id
	JOIN academic.academic_periods ap ON ap.id = cs.academic_period_id
	JOIN organization.campuses camp ON camp.id = cs.campus_id
	JOIN academic.study_plan_courses spc ON spc.course_id = c.id
	JOIN academic.course_outcome_mappings com ON com.study_plan_course_id = spc.id
	JOIN filtered_outcomes o ON o.id = com.outcome_id
	JOIN core.types ot ON ot.id = com.outcome_type_id
	WHERE cs.academic_period_id = $1::int
	  AND ot.code = 'TG302-T002'
	  AND ($2::int IS NULL OR o.id = $2::int)
	  AND ($3::int[] IS NULL OR camp.id = ANY($3::int[]))
	GROUP BY c.code, c.name, o.outcome_code, o.outcome_name, camp.id, camp.name, ap.code
)
SELECT
	course_code                                                  AS "courseCode",
	COALESCE(course_name->>$4::text, course_name->>'es', '')     AS "courseName",
	outcome_code                                                 AS "outcomeCode",
	COALESCE(outcome_name->>$4::text, outcome_name->>'es', '')   AS "outcomeName",
	total_students                                               AS "totalStudents",
	students_red                                                 AS "studentsRed",
	students_yellow                                              AS "studentsYellow",
	students_green                                                AS "studentsGreen",
	campus_id                                                         AS "campusId",
	COALESCE(campus->>$4::text, campus->>'es', '')                   AS "campus",
	academic_period_cycle                                              AS "academicPeriodCycle"
FROM course_outcome_results
ORDER BY campus, course_code, outcome_code
`;

export const SEMAPHORE_RV_SCREEN_SQL = `
WITH filtered_outcomes AS (
	SELECT id, outcome_code, outcome_name
	FROM accreditation.outcomes
	WHERE is_active = true
	  AND ($5::int IS NULL OR program_commission_id = $5::int)
),
${RV_CLASSIFIED_GRADES_CTE},
course_outcome_results AS (
	SELECT
		c.code                                                        AS course_code,
		c.name                                                        AS course_name,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.id                                                       AS campus_id,
		camp.name                                                     AS campus,
		ap.code                                                       AS academic_period_cycle,
		COUNT(DISTINCT cg.enrollment_id)                              AS total_students,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 1 THEN cg.enrollment_id END) AS students_red,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 2 THEN cg.enrollment_id END) AS students_yellow,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 3 THEN cg.enrollment_id END) AS students_green
	FROM classified_grades cg
	JOIN academic.course_sections cs ON cs.id = cg.course_section_id
	JOIN academic.courses c ON c.id = cs.course_id
	JOIN academic.academic_periods ap ON ap.id = cs.academic_period_id
	JOIN organization.campuses camp ON camp.id = cs.campus_id
	JOIN filtered_outcomes o ON o.id = cg.outcome_id
	WHERE ($2::int IS NULL OR o.id = $2::int)
	  AND ($3::int[] IS NULL OR camp.id = ANY($3::int[]))
	GROUP BY c.code, c.name, o.outcome_code, o.outcome_name, camp.id, camp.name, ap.code
)
SELECT
	course_code                                                  AS "courseCode",
	COALESCE(course_name->>$4::text, course_name->>'es', '')     AS "courseName",
	outcome_code                                                 AS "outcomeCode",
	COALESCE(outcome_name->>$4::text, outcome_name->>'es', '')   AS "outcomeName",
	total_students                                               AS "totalStudents",
	students_red                                                 AS "studentsRed",
	students_yellow                                              AS "studentsYellow",
	students_green                                                AS "studentsGreen",
	campus_id                                                         AS "campusId",
	COALESCE(campus->>$4::text, campus->>'es', '')                   AS "campus",
	academic_period_cycle                                              AS "academicPeriodCycle"
FROM course_outcome_results
ORDER BY campus, course_code, outcome_code
`;

export const SEMAPHORE_RC_DETAIL_SQL = `
WITH course_grades AS (
	-- See SEMAPHORE_RC_SCREEN_SQL: single designated-grade-type row, ASISTIO only.
	SELECT
		sse.id AS enrollment_id,
		scg.grade AS grade
	FROM academic.student_course_grades scg
	JOIN academic.student_section_enrollments sse ON sse.id = scg.student_section_enrollment_id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	JOIN academic.courses c ON c.id = cs.course_id
	JOIN academic.study_plan_courses spc ON spc.course_id = c.id
	JOIN academic.study_plan_academic_periods spap
		ON spap.id = spc.study_plan_academic_period_id
		AND spap.academic_period_id = cs.academic_period_id
	JOIN core.types qst ON qst.id = (scg.extra->>'qualification_status_type_id')::int
	WHERE cs.academic_period_id = $1::int
	  AND sse.is_active = true
	  AND es.is_active = true
	  AND scg.grade_type_id = (spc.extra->>'grade_type_id')::int
	  AND qst.code = 'TG404-T001'
),
filtered_outcomes AS (
	SELECT id, outcome_code, outcome_name
	FROM accreditation.outcomes
	WHERE is_active = true
	  AND ($5::int IS NULL OR program_commission_id = $5::int)
),
levels AS (
	SELECT
		pl.id, pl.min_score, pl.max_score,
		ROW_NUMBER() OVER (ORDER BY pl.max_score ASC) AS level_rank
	FROM academic.performance_levels pl
	JOIN core.types it ON it.id = pl.instrument_type_id
	WHERE it.code = 'TG206-T003'
	  AND pl.academic_period_id = $1::int
	  AND pl.is_active = true
),
classified_grades AS (
	SELECT
		cg.enrollment_id,
		cg.grade,
		lv.level_rank
	FROM course_grades cg
	LEFT JOIN levels lv
		ON cg.grade >= lv.min_score AND cg.grade <= lv.max_score
),
course_outcome_results AS (
	SELECT
		c.code                                                        AS course_code,
		c.name                                                        AS course_name,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.id                                                       AS campus_id,
		camp.name                                                     AS campus,
		ap.code                                                       AS academic_period_cycle,
		COUNT(DISTINCT cg.enrollment_id)                              AS total_students,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 1 THEN cg.enrollment_id END) AS students_red,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 2 THEN cg.enrollment_id END) AS students_yellow,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 3 THEN cg.enrollment_id END) AS students_green
	FROM classified_grades cg
	JOIN academic.student_section_enrollments sse ON sse.id = cg.enrollment_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	JOIN academic.courses c ON c.id = cs.course_id
	JOIN academic.academic_periods ap ON ap.id = cs.academic_period_id
	JOIN organization.campuses camp ON camp.id = cs.campus_id
	JOIN academic.study_plan_courses spc ON spc.course_id = c.id
	JOIN academic.course_outcome_mappings com ON com.study_plan_course_id = spc.id
	JOIN filtered_outcomes o ON o.id = com.outcome_id
	JOIN core.types ot ON ot.id = com.outcome_type_id
	WHERE cs.academic_period_id = $1::int
	  AND ot.code = 'TG302-T002'
	  AND ($2::int IS NULL OR o.id = $2::int)
	  AND ($3::int[] IS NULL OR camp.id = ANY($3::int[]))
	GROUP BY c.code, c.name, o.outcome_code, o.outcome_name, camp.id, camp.name, ap.code
),
level_rows AS (
	SELECT course_code, course_name, outcome_code, outcome_name, campus, campus_id, academic_period_cycle,
		1 AS level_rank, students_red AS quantity, total_students
	FROM course_outcome_results
	UNION ALL
	SELECT course_code, course_name, outcome_code, outcome_name, campus, campus_id, academic_period_cycle,
		2 AS level_rank, students_yellow AS quantity, total_students
	FROM course_outcome_results
	UNION ALL
	SELECT course_code, course_name, outcome_code, outcome_name, campus, campus_id, academic_period_cycle,
		3 AS level_rank, students_green AS quantity, total_students
	FROM course_outcome_results
),
weighted_levels AS (
	SELECT
		*,
		ROUND(quantity::numeric / NULLIF(total_students, 0) * 100, 2) AS percentage
	FROM level_rows
),
scored AS (
	SELECT
		*,
		CASE WHEN level_rank = 1 AND percentage >= ${CRITICAL_RED_THRESHOLD} THEN 1 ELSE 0 END AS weight
	FROM weighted_levels
),
windowed AS (
	-- "Is there a critical course?" must be decided per Campus+Outcome (group_max_weight),
	-- not report-wide -- a critical course somewhere else must not suppress the
	-- dominant-course fallback for a Campus+Outcome that has no critical course of its own.
	-- Partitioned by the campus NAME, not campus_id -- kept as-is (campus_id is 1:1 with the
	-- name here) rather than touched, to avoid changing this report's numbers as a side effect
	-- of an unrelated perf change; campus_id only rides along as an extra passthrough column so
	-- the service can group rows per campus in memory instead of re-querying per campus.
	SELECT
		*,
		MAX(weight) OVER (PARTITION BY campus, outcome_code)        AS group_max_weight,
		MAX(quantity) OVER (PARTITION BY campus, outcome_code)    AS group_max_quantity
	FROM scored
),
final_rows AS (
	SELECT
		*,
		CASE WHEN group_max_weight = 1 THEN weight ELSE quantity END     AS effective_weight,
		CASE WHEN group_max_weight = 1 THEN group_max_weight ELSE group_max_quantity END AS effective_group_max
	FROM windowed
)
SELECT
	course_code                                                  AS "courseCode",
	COALESCE(course_name->>$4::text, course_name->>'es', '')     AS "courseName",
	outcome_code                                                 AS "outcomeCode",
	COALESCE(outcome_name->>$4::text, outcome_name->>'es', '')   AS "outcomeName",
	level_rank                                                   AS "levelRank",
	quantity                                                     AS "quantity",
	total_students                                               AS "totalStudents",
	percentage                                                   AS "percentage",
	campus_id                                                         AS "campusId",
	COALESCE(campus->>$4::text, campus->>'es', '')                   AS "campus",
	academic_period_cycle                                              AS "academicPeriodCycle"
FROM final_rows
WHERE effective_weight = effective_group_max
ORDER BY campus, outcome_code, level_rank, course_code
`;

export const SEMAPHORE_RC_SUMMARY_SQL = `
WITH course_grades AS (
	-- See SEMAPHORE_RC_SCREEN_SQL: single designated-grade-type row, ASISTIO only.
	SELECT
		sse.id AS enrollment_id,
		scg.grade AS grade
	FROM academic.student_course_grades scg
	JOIN academic.student_section_enrollments sse ON sse.id = scg.student_section_enrollment_id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	JOIN academic.courses c ON c.id = cs.course_id
	JOIN academic.study_plan_courses spc ON spc.course_id = c.id
	JOIN academic.study_plan_academic_periods spap
		ON spap.id = spc.study_plan_academic_period_id
		AND spap.academic_period_id = cs.academic_period_id
	JOIN core.types qst ON qst.id = (scg.extra->>'qualification_status_type_id')::int
	WHERE cs.academic_period_id = $1::int
	  AND sse.is_active = true
	  AND es.is_active = true
	  AND scg.grade_type_id = (spc.extra->>'grade_type_id')::int
	  AND qst.code = 'TG404-T001'
),
filtered_outcomes AS (
	SELECT id, outcome_code, outcome_name
	FROM accreditation.outcomes
	WHERE is_active = true
	  AND ($5::int IS NULL OR program_commission_id = $5::int)
),
levels AS (
	SELECT
		pl.id, pl.min_score, pl.max_score,
		ROW_NUMBER() OVER (ORDER BY pl.max_score ASC) AS level_rank
	FROM academic.performance_levels pl
	JOIN core.types it ON it.id = pl.instrument_type_id
	WHERE it.code = 'TG206-T003'
	  AND pl.academic_period_id = $1::int
	  AND pl.is_active = true
),
classified_grades AS (
	SELECT
		cg.enrollment_id,
		cg.grade,
		lv.level_rank
	FROM course_grades cg
	LEFT JOIN levels lv
		ON cg.grade >= lv.min_score AND cg.grade <= lv.max_score
),
course_outcome_results AS (
	SELECT
		c.code                                                        AS course_code,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.id                                                       AS campus_id,
		camp.name                                                     AS campus,
		COUNT(DISTINCT cg.enrollment_id)                              AS total_students,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 1 THEN cg.enrollment_id END) AS students_red,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 2 THEN cg.enrollment_id END) AS students_yellow,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 3 THEN cg.enrollment_id END) AS students_green
	FROM classified_grades cg
	JOIN academic.student_section_enrollments sse ON sse.id = cg.enrollment_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	JOIN academic.courses c ON c.id = cs.course_id
	JOIN organization.campuses camp ON camp.id = cs.campus_id
	JOIN academic.study_plan_courses spc ON spc.course_id = c.id
	JOIN academic.course_outcome_mappings com ON com.study_plan_course_id = spc.id
	JOIN filtered_outcomes o ON o.id = com.outcome_id
	JOIN core.types ot ON ot.id = com.outcome_type_id
	WHERE cs.academic_period_id = $1::int
	  AND ot.code = 'TG302-T002'
	  AND ($2::int IS NULL OR o.id = $2::int)
	  AND ($3::int[] IS NULL OR camp.id = ANY($3::int[]))
	GROUP BY c.code, o.outcome_code, o.outcome_name, camp.id, camp.name
),
level_rows AS (
	SELECT course_code, outcome_code, outcome_name, campus, campus_id, 1 AS level_rank, students_red AS quantity, total_students FROM course_outcome_results
	UNION ALL
	SELECT course_code, outcome_code, outcome_name, campus, campus_id, 2 AS level_rank, students_yellow AS quantity, total_students FROM course_outcome_results
	UNION ALL
	SELECT course_code, outcome_code, outcome_name, campus, campus_id, 3 AS level_rank, students_green AS quantity, total_students FROM course_outcome_results
),
weighted_levels AS (
	SELECT
		*,
		ROUND(quantity::numeric / NULLIF(total_students, 0) * 100, 2) AS percentage
	FROM level_rows
),
scored AS (
	SELECT
		*,
		CASE WHEN level_rank = 1 AND percentage >= ${CRITICAL_RED_THRESHOLD} THEN 1 ELSE 0 END AS weight
	FROM weighted_levels
),
windowed AS (
	-- "Is there a critical course?" must be decided per Campus+Outcome (group_max_weight),
	-- not report-wide.
	SELECT
		*,
		MAX(weight) OVER (PARTITION BY campus, outcome_code)        AS group_max_weight,
		MAX(quantity) OVER (PARTITION BY campus, outcome_code)    AS group_max_quantity
	FROM scored
),
final_rows AS (
	SELECT
		*,
		CASE WHEN group_max_weight = 1 THEN weight ELSE quantity END     AS effective_weight,
		CASE WHEN group_max_weight = 1 THEN group_max_weight ELSE group_max_quantity END AS effective_group_max,
		ROW_NUMBER() OVER (PARTITION BY campus, outcome_code ORDER BY level_rank ASC) AS row_rank
	FROM windowed
)
SELECT
	outcome_code                                                 AS "outcomeCode",
	COALESCE(outcome_name->>$4::text, outcome_name->>'es', '')   AS "outcomeName",
	level_rank                                                   AS "levelRank",
	quantity                                                     AS "quantity",
	total_students                                               AS "totalStudents",
	percentage                                                   AS "percentage",
	campus_id                                                         AS "campusId",
	COALESCE(campus->>$4::text, campus->>'es', '')                   AS "campus"
FROM final_rows
-- Only critical outcomes: a (campus, outcome) group is critical when its lowest
-- level (rank 1) holds >= ${CRITICAL_RED_THRESHOLD}% of students, i.e. group_max_weight = 1.
WHERE group_max_weight = 1 AND effective_weight = effective_group_max AND row_rank = 1
ORDER BY campus, outcome_code
`;

export const SEMAPHORE_RV_DETAIL_SQL = `
WITH filtered_outcomes AS (
	SELECT id, outcome_code, outcome_name
	FROM accreditation.outcomes
	WHERE is_active = true
	  AND ($5::int IS NULL OR program_commission_id = $5::int)
),
${RV_CLASSIFIED_GRADES_CTE},
course_outcome_results AS (
	SELECT
		c.code                                                        AS course_code,
		c.name                                                        AS course_name,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.id                                                       AS campus_id,
		camp.name                                                     AS campus,
		ap.code                                                       AS academic_period_cycle,
		COUNT(DISTINCT cg.enrollment_id)                              AS total_students,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 1 THEN cg.enrollment_id END) AS students_red,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 2 THEN cg.enrollment_id END) AS students_yellow,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 3 THEN cg.enrollment_id END) AS students_green
	FROM classified_grades cg
	JOIN academic.course_sections cs ON cs.id = cg.course_section_id
	JOIN academic.courses c ON c.id = cs.course_id
	JOIN academic.academic_periods ap ON ap.id = cs.academic_period_id
	JOIN organization.campuses camp ON camp.id = cs.campus_id
	JOIN filtered_outcomes o ON o.id = cg.outcome_id
	WHERE ($2::int IS NULL OR o.id = $2::int)
	  AND ($3::int[] IS NULL OR camp.id = ANY($3::int[]))
	GROUP BY c.code, c.name, o.outcome_code, o.outcome_name, camp.id, camp.name, ap.code
),
level_rows AS (
	SELECT course_code, course_name, outcome_code, outcome_name, campus, campus_id, academic_period_cycle,
		1 AS level_rank, students_red AS quantity, total_students
	FROM course_outcome_results
	UNION ALL
	SELECT course_code, course_name, outcome_code, outcome_name, campus, campus_id, academic_period_cycle,
		2 AS level_rank, students_yellow AS quantity, total_students
	FROM course_outcome_results
	UNION ALL
	SELECT course_code, course_name, outcome_code, outcome_name, campus, campus_id, academic_period_cycle,
		3 AS level_rank, students_green AS quantity, total_students
	FROM course_outcome_results
),
weighted_levels AS (
	SELECT
		*,
		ROUND(quantity::numeric / NULLIF(total_students, 0) * 100, 2) AS percentage
	FROM level_rows
),
scored AS (
	SELECT
		*,
		CASE WHEN level_rank = 1 AND percentage >= ${CRITICAL_RED_THRESHOLD} THEN 1 ELSE 0 END AS weight
	FROM weighted_levels
),
windowed AS (
	-- "Is there a critical course?" must be decided per Campus+Outcome (group_max_weight),
	-- not report-wide -- a critical course somewhere else must not suppress the
	-- dominant-course fallback for a Campus+Outcome that has no critical course of its own.
	SELECT
		*,
		MAX(weight) OVER (PARTITION BY campus, outcome_code)        AS group_max_weight,
		MAX(quantity) OVER (PARTITION BY campus, outcome_code)    AS group_max_quantity
	FROM scored
),
final_rows AS (
	SELECT
		*,
		CASE WHEN group_max_weight = 1 THEN weight ELSE quantity END     AS effective_weight,
		CASE WHEN group_max_weight = 1 THEN group_max_weight ELSE group_max_quantity END AS effective_group_max
	FROM windowed
)
SELECT
	course_code                                                  AS "courseCode",
	COALESCE(course_name->>$4::text, course_name->>'es', '')     AS "courseName",
	outcome_code                                                 AS "outcomeCode",
	COALESCE(outcome_name->>$4::text, outcome_name->>'es', '')   AS "outcomeName",
	level_rank                                                   AS "levelRank",
	quantity                                                     AS "quantity",
	total_students                                               AS "totalStudents",
	percentage                                                   AS "percentage",
	campus_id                                                         AS "campusId",
	COALESCE(campus->>$4::text, campus->>'es', '')                   AS "campus",
	academic_period_cycle                                              AS "academicPeriodCycle"
FROM final_rows
WHERE effective_weight = effective_group_max
ORDER BY campus, outcome_code, level_rank, course_code
`;

export const SEMAPHORE_RV_SUMMARY_SQL = `
WITH filtered_outcomes AS (
	SELECT id, outcome_code, outcome_name
	FROM accreditation.outcomes
	WHERE is_active = true
	  AND ($5::int IS NULL OR program_commission_id = $5::int)
),
${RV_CLASSIFIED_GRADES_CTE},
course_outcome_results AS (
	SELECT
		c.code                                                        AS course_code,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.id                                                       AS campus_id,
		camp.name                                                     AS campus,
		COUNT(DISTINCT cg.enrollment_id)                              AS total_students,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 1 THEN cg.enrollment_id END) AS students_red,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 2 THEN cg.enrollment_id END) AS students_yellow,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 3 THEN cg.enrollment_id END) AS students_green
	FROM classified_grades cg
	JOIN academic.course_sections cs ON cs.id = cg.course_section_id
	JOIN academic.courses c ON c.id = cs.course_id
	JOIN organization.campuses camp ON camp.id = cs.campus_id
	JOIN filtered_outcomes o ON o.id = cg.outcome_id
	WHERE ($2::int IS NULL OR o.id = $2::int)
	  AND ($3::int[] IS NULL OR camp.id = ANY($3::int[]))
	GROUP BY c.code, o.outcome_code, o.outcome_name, camp.id, camp.name
),
level_rows AS (
	SELECT course_code, outcome_code, outcome_name, campus, campus_id, 1 AS level_rank, students_red AS quantity, total_students FROM course_outcome_results
	UNION ALL
	SELECT course_code, outcome_code, outcome_name, campus, campus_id, 2 AS level_rank, students_yellow AS quantity, total_students FROM course_outcome_results
	UNION ALL
	SELECT course_code, outcome_code, outcome_name, campus, campus_id, 3 AS level_rank, students_green AS quantity, total_students FROM course_outcome_results
),
weighted_levels AS (
	SELECT
		*,
		ROUND(quantity::numeric / NULLIF(total_students, 0) * 100, 2) AS percentage
	FROM level_rows
),
scored AS (
	SELECT
		*,
		CASE WHEN level_rank = 1 AND percentage >= ${CRITICAL_RED_THRESHOLD} THEN 1 ELSE 0 END AS weight
	FROM weighted_levels
),
windowed AS (
	-- "Is there a critical course?" must be decided per Campus+Outcome (group_max_weight),
	-- not report-wide.
	SELECT
		*,
		MAX(weight) OVER (PARTITION BY campus, outcome_code)        AS group_max_weight,
		MAX(quantity) OVER (PARTITION BY campus, outcome_code)    AS group_max_quantity
	FROM scored
),
final_rows AS (
	SELECT
		*,
		CASE WHEN group_max_weight = 1 THEN weight ELSE quantity END     AS effective_weight,
		CASE WHEN group_max_weight = 1 THEN group_max_weight ELSE group_max_quantity END AS effective_group_max,
		ROW_NUMBER() OVER (PARTITION BY campus, outcome_code ORDER BY level_rank ASC) AS row_rank
	FROM windowed
)
SELECT
	outcome_code                                                 AS "outcomeCode",
	COALESCE(outcome_name->>$4::text, outcome_name->>'es', '')   AS "outcomeName",
	level_rank                                                   AS "levelRank",
	quantity                                                     AS "quantity",
	total_students                                               AS "totalStudents",
	percentage                                                   AS "percentage",
	campus_id                                                         AS "campusId",
	COALESCE(campus->>$4::text, campus->>'es', '')                   AS "campus"
FROM final_rows
-- Only critical outcomes: a (campus, outcome) group is critical when its lowest
-- level (rank 1) holds >= ${CRITICAL_RED_THRESHOLD}% of students, i.e. group_max_weight = 1.
WHERE group_max_weight = 1 AND effective_weight = effective_group_max AND row_rank = 1
ORDER BY campus, outcome_code
`;

export const SEMAPHORE_LEVELS_LEGEND_SQL = `
SELECT
	COALESCE(pl.name->>$3::text, pl.name->>'es', '') AS "name",
	pl.min_score                                     AS "minScore",
	pl.max_score                                     AS "maxScore",
	COALESCE(pl.extra->>'color', '#6b7280')           AS "color"
FROM academic.performance_levels pl
JOIN core.types it ON it.id = pl.instrument_type_id
WHERE it.code = $2::text
  AND pl.academic_period_id = $1::int
  AND pl.is_active = true
ORDER BY pl.min_score ASC
`;

export const SEMAPHORE_METADATA_SQL = `
WITH target_pc AS (
	SELECT pc.id, pc.program_id, pc.commission_id, pc.academic_period_id
	FROM accreditation.program_commissions pc
	WHERE pc.id = $1::int AND pc.is_active = true
)
SELECT
	COALESCE(p.name->>$3::text, p.name->>'es', '')   AS "programName",
	COALESCE(c.name->>$3::text, c.name->>'es', '')    AS "commissionName",
	ap.code                                      AS "academicPeriodCode",
	COALESCE(acc.code, '')                       AS "accreditorCode"
FROM target_pc tpc
JOIN academic.programs p ON p.id = tpc.program_id
JOIN academic.academic_periods ap ON ap.id = tpc.academic_period_id
LEFT JOIN accreditation.commissions c ON c.id = tpc.commission_id
LEFT JOIN accreditation.accreditors acc ON acc.id = c.accreditor_id
UNION ALL
SELECT
	'' AS "programName",
	'' AS "commissionName",
	ap.code AS "academicPeriodCode",
	'' AS "accreditorCode"
FROM academic.academic_periods ap
WHERE ap.id = $2::int
  AND NOT EXISTS (SELECT 1 FROM target_pc)
LIMIT 1
`;

// Every active campus, for the download endpoints to decide whether a requested campus selection
// is "all of them" (-> one consolidated report) or a proper subset (-> single report / zip -- see
// SemaphoreReportsService.resolveCampusPlan).
export const SEMAPHORE_CAMPUSES_SQL = `
SELECT
	id                                          AS "id",
	code                                        AS "code",
	COALESCE(name->>$1::text, name->>'es', '')  AS "name"
FROM organization.campuses
WHERE is_active = true
ORDER BY id
`;
