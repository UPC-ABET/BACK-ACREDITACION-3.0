const CRITICAL_RED_THRESHOLD = 23;

// Unfiltered course+outcome breakdown, used by the JSON screen endpoint (no critical/representative filtering).
export const SEMAPHORE_RC_SCREEN_SQL = `
WITH weighted_grades AS (
	SELECT
		sse.id AS enrollment_id,
		ROUND(SUM(scg.grade * scg.grade_type_percentage / 100), 2) AS weighted_average
	FROM academic.student_course_grades scg
	JOIN academic.student_section_enrollments sse ON sse.id = scg.student_section_enrollment_id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	WHERE cs.academic_period_id = $1::int
	  AND sse.is_active = true
	  AND es.is_active = true
	GROUP BY sse.id
	HAVING SUM(scg.grade * scg.grade_type_percentage / 100) IS NOT NULL
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
		wg.enrollment_id,
		wg.weighted_average,
		lv.level_rank
	FROM weighted_grades wg
	LEFT JOIN levels lv
		ON wg.weighted_average >= lv.min_score AND wg.weighted_average <= lv.max_score
),
course_outcome_results AS (
	SELECT
		c.code                                                        AS course_code,
		c.name                                                        AS course_name,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.name                                                     AS sede,
		ap.code                                                       AS ciclo_academico,
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
	  AND ($3::int IS NULL OR camp.id = $3::int)
	GROUP BY c.code, c.name, o.outcome_code, o.outcome_name, camp.name, ap.code
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
	COALESCE(sede->>$4::text, sede->>'es', '')                   AS "sede",
	ciclo_academico                                              AS "cicloAcademico"
FROM course_outcome_results
ORDER BY sede, course_code, outcome_code
`;

export const SEMAPHORE_RV_SCREEN_SQL = `
WITH filtered_outcomes AS (
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
	WHERE it.code = 'TG206-T004'
	  AND pl.academic_period_id = $1::int
	  AND pl.is_active = true
),
scaled_grades AS (
	SELECT
		sse.id AS enrollment_id,
		scog.outcome_id,
		CASE
			WHEN NULLIF(scog.extra->>'max_outcome', '')::numeric > 0
				THEN ROUND((scog.grade * 20) / (scog.extra->>'max_outcome')::numeric, 2)
			ELSE scog.grade
		END AS scaled_grade
	FROM evidence.student_course_outcome_grades scog
	JOIN academic.student_section_enrollments sse ON sse.id = scog.student_section_enrollment_id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN evidence.evaluations ev ON ev.id = scog.evaluation_id
	WHERE sse.is_active = true
	  AND es.is_active = true
	  AND ($6::int[] IS NULL OR ev.rubric_id = ANY($6::int[]))
),
classified_grades AS (
	SELECT
		sg.enrollment_id,
		sg.scaled_grade AS grade,
		sg.outcome_id,
		lv.level_rank
	FROM scaled_grades sg
	LEFT JOIN levels lv
		ON sg.scaled_grade >= lv.min_score AND sg.scaled_grade <= lv.max_score
),
course_outcome_results AS (
	SELECT
		c.code                                                        AS course_code,
		c.name                                                        AS course_name,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.name                                                     AS sede,
		ap.code                                                       AS ciclo_academico,
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
	JOIN filtered_outcomes o ON o.id = cg.outcome_id
	WHERE cs.academic_period_id = $1::int
	  AND ($2::int IS NULL OR o.id = $2::int)
	  AND ($3::int IS NULL OR camp.id = $3::int)
	GROUP BY c.code, c.name, o.outcome_code, o.outcome_name, camp.name, ap.code
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
	COALESCE(sede->>$4::text, sede->>'es', '')                   AS "sede",
	ciclo_academico                                              AS "cicloAcademico"
FROM course_outcome_results
ORDER BY sede, course_code, outcome_code
`;

export const SEMAPHORE_RC_DETAIL_SQL = `
WITH weighted_grades AS (
	SELECT
		sse.id AS enrollment_id,
		ROUND(SUM(scg.grade * scg.grade_type_percentage / 100), 2) AS weighted_average
	FROM academic.student_course_grades scg
	JOIN academic.student_section_enrollments sse ON sse.id = scg.student_section_enrollment_id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	WHERE cs.academic_period_id = $1::int
	  AND sse.is_active = true
	  AND es.is_active = true
	GROUP BY sse.id
	HAVING SUM(scg.grade * scg.grade_type_percentage / 100) IS NOT NULL
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
		wg.enrollment_id,
		wg.weighted_average,
		lv.level_rank
	FROM weighted_grades wg
	LEFT JOIN levels lv
		ON wg.weighted_average >= lv.min_score AND wg.weighted_average <= lv.max_score
),
course_outcome_results AS (
	SELECT
		c.code                                                        AS course_code,
		c.name                                                        AS course_name,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.name                                                     AS sede,
		ap.code                                                       AS ciclo_academico,
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
	  AND ($3::int IS NULL OR camp.id = $3::int)
	GROUP BY c.code, c.name, o.outcome_code, o.outcome_name, camp.name, ap.code
),
level_rows AS (
	SELECT course_code, course_name, outcome_code, outcome_name, sede, ciclo_academico,
		1 AS level_rank, students_red AS cantidad, total_students
	FROM course_outcome_results
	UNION ALL
	SELECT course_code, course_name, outcome_code, outcome_name, sede, ciclo_academico,
		2 AS level_rank, students_yellow AS cantidad, total_students
	FROM course_outcome_results
	UNION ALL
	SELECT course_code, course_name, outcome_code, outcome_name, sede, ciclo_academico,
		3 AS level_rank, students_green AS cantidad, total_students
	FROM course_outcome_results
),
weighted_levels AS (
	SELECT
		*,
		ROUND(cantidad::numeric / NULLIF(total_students, 0) * 100, 2) AS porcentaje
	FROM level_rows
),
scored AS (
	SELECT
		*,
		CASE WHEN level_rank = 1 AND porcentaje >= ${CRITICAL_RED_THRESHOLD} THEN 1 ELSE 0 END AS peso
	FROM weighted_levels
),
windowed AS (
	SELECT
		*,
		MAX(peso) OVER ()                                       AS global_max_peso,
		MAX(peso) OVER (PARTITION BY sede, outcome_code)        AS group_max_peso,
		MAX(cantidad) OVER (PARTITION BY sede, outcome_code)    AS group_max_cantidad
	FROM scored
),
final_rows AS (
	SELECT
		*,
		CASE WHEN global_max_peso = 1 THEN peso ELSE cantidad END     AS effective_peso,
		CASE WHEN global_max_peso = 1 THEN group_max_peso ELSE group_max_cantidad END AS effective_group_max
	FROM windowed
)
SELECT
	course_code                                                  AS "courseCode",
	COALESCE(course_name->>$4::text, course_name->>'es', '')     AS "courseName",
	outcome_code                                                 AS "outcomeCode",
	COALESCE(outcome_name->>$4::text, outcome_name->>'es', '')   AS "outcomeName",
	level_rank                                                   AS "levelRank",
	cantidad                                                     AS "cantidad",
	total_students                                               AS "totalStudents",
	COALESCE(sede->>$4::text, sede->>'es', '')                   AS "sede",
	ciclo_academico                                              AS "cicloAcademico"
FROM final_rows
WHERE effective_peso = effective_group_max
ORDER BY sede, outcome_code, level_rank, course_code
`;

export const SEMAPHORE_RC_SUMMARY_SQL = `
WITH weighted_grades AS (
	SELECT
		sse.id AS enrollment_id,
		ROUND(SUM(scg.grade * scg.grade_type_percentage / 100), 2) AS weighted_average
	FROM academic.student_course_grades scg
	JOIN academic.student_section_enrollments sse ON sse.id = scg.student_section_enrollment_id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	WHERE cs.academic_period_id = $1::int
	  AND sse.is_active = true
	  AND es.is_active = true
	GROUP BY sse.id
	HAVING SUM(scg.grade * scg.grade_type_percentage / 100) IS NOT NULL
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
		wg.enrollment_id,
		wg.weighted_average,
		lv.level_rank
	FROM weighted_grades wg
	LEFT JOIN levels lv
		ON wg.weighted_average >= lv.min_score AND wg.weighted_average <= lv.max_score
),
course_outcome_results AS (
	SELECT
		c.code                                                        AS course_code,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.name                                                     AS sede,
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
	  AND ($3::int IS NULL OR camp.id = $3::int)
	GROUP BY c.code, o.outcome_code, o.outcome_name, camp.name
),
level_rows AS (
	SELECT course_code, outcome_code, outcome_name, sede, 1 AS level_rank, students_red AS cantidad, total_students FROM course_outcome_results
	UNION ALL
	SELECT course_code, outcome_code, outcome_name, sede, 2 AS level_rank, students_yellow AS cantidad, total_students FROM course_outcome_results
	UNION ALL
	SELECT course_code, outcome_code, outcome_name, sede, 3 AS level_rank, students_green AS cantidad, total_students FROM course_outcome_results
),
weighted_levels AS (
	SELECT
		*,
		ROUND(cantidad::numeric / NULLIF(total_students, 0) * 100, 2) AS porcentaje
	FROM level_rows
),
scored AS (
	SELECT
		*,
		CASE WHEN level_rank = 1 AND porcentaje >= ${CRITICAL_RED_THRESHOLD} THEN 1 ELSE 0 END AS peso
	FROM weighted_levels
),
windowed AS (
	SELECT
		*,
		MAX(peso) OVER ()                                       AS global_max_peso,
		MAX(peso) OVER (PARTITION BY sede, outcome_code)        AS group_max_peso,
		MAX(cantidad) OVER (PARTITION BY sede, outcome_code)    AS group_max_cantidad
	FROM scored
),
final_rows AS (
	SELECT
		*,
		CASE WHEN global_max_peso = 1 THEN peso ELSE cantidad END     AS effective_peso,
		CASE WHEN global_max_peso = 1 THEN group_max_peso ELSE group_max_cantidad END AS effective_group_max,
		ROW_NUMBER() OVER (PARTITION BY sede, outcome_code ORDER BY level_rank ASC) AS row_rank
	FROM windowed
)
SELECT
	outcome_code                                                 AS "outcomeCode",
	COALESCE(outcome_name->>$4::text, outcome_name->>'es', '')   AS "outcomeName",
	level_rank                                                   AS "levelRank",
	cantidad                                                     AS "cantidad",
	total_students                                               AS "totalStudents",
	porcentaje                                                   AS "porcentaje",
	COALESCE(sede->>$4::text, sede->>'es', '')                   AS "sede"
FROM final_rows
WHERE effective_peso = effective_group_max AND row_rank = 1
ORDER BY sede, outcome_code
`;

export const SEMAPHORE_RV_DETAIL_SQL = `
WITH filtered_outcomes AS (
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
	WHERE it.code = 'TG206-T004'
	  AND pl.academic_period_id = $1::int
	  AND pl.is_active = true
),
scaled_grades AS (
	SELECT
		sse.id AS enrollment_id,
		scog.outcome_id,
		sse.course_section_id,
		CASE
			WHEN NULLIF(scog.extra->>'max_outcome', '')::numeric > 0
				THEN ROUND((scog.grade * 20) / (scog.extra->>'max_outcome')::numeric, 2)
			ELSE scog.grade
		END AS scaled_grade
	FROM evidence.student_course_outcome_grades scog
	JOIN academic.student_section_enrollments sse ON sse.id = scog.student_section_enrollment_id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN evidence.evaluations ev ON ev.id = scog.evaluation_id
	WHERE sse.is_active = true
	  AND es.is_active = true
	  AND ($6::int[] IS NULL OR ev.rubric_id = ANY($6::int[]))
),
classified_grades AS (
	SELECT
		sg.enrollment_id,
		sg.scaled_grade AS grade,
		sg.outcome_id,
		sg.course_section_id,
		lv.level_rank
	FROM scaled_grades sg
	LEFT JOIN levels lv
		ON sg.scaled_grade >= lv.min_score AND sg.scaled_grade <= lv.max_score
),
course_outcome_results AS (
	SELECT
		c.code                                                        AS course_code,
		c.name                                                        AS course_name,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.name                                                     AS sede,
		ap.code                                                       AS ciclo_academico,
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
	WHERE cs.academic_period_id = $1::int
	  AND ($2::int IS NULL OR o.id = $2::int)
	  AND ($3::int IS NULL OR camp.id = $3::int)
	GROUP BY c.code, c.name, o.outcome_code, o.outcome_name, camp.name, ap.code
),
level_rows AS (
	SELECT course_code, course_name, outcome_code, outcome_name, sede, ciclo_academico,
		1 AS level_rank, students_red AS cantidad, total_students
	FROM course_outcome_results
	UNION ALL
	SELECT course_code, course_name, outcome_code, outcome_name, sede, ciclo_academico,
		2 AS level_rank, students_yellow AS cantidad, total_students
	FROM course_outcome_results
	UNION ALL
	SELECT course_code, course_name, outcome_code, outcome_name, sede, ciclo_academico,
		3 AS level_rank, students_green AS cantidad, total_students
	FROM course_outcome_results
),
weighted_levels AS (
	SELECT
		*,
		ROUND(cantidad::numeric / NULLIF(total_students, 0) * 100, 2) AS porcentaje
	FROM level_rows
),
scored AS (
	SELECT
		*,
		CASE WHEN level_rank = 1 AND porcentaje >= ${CRITICAL_RED_THRESHOLD} THEN 1 ELSE 0 END AS peso
	FROM weighted_levels
),
windowed AS (
	SELECT
		*,
		MAX(peso) OVER ()                                       AS global_max_peso,
		MAX(peso) OVER (PARTITION BY sede, outcome_code)        AS group_max_peso,
		MAX(cantidad) OVER (PARTITION BY sede, outcome_code)    AS group_max_cantidad
	FROM scored
),
final_rows AS (
	SELECT
		*,
		CASE WHEN global_max_peso = 1 THEN peso ELSE cantidad END     AS effective_peso,
		CASE WHEN global_max_peso = 1 THEN group_max_peso ELSE group_max_cantidad END AS effective_group_max
	FROM windowed
)
SELECT
	course_code                                                  AS "courseCode",
	COALESCE(course_name->>$4::text, course_name->>'es', '')     AS "courseName",
	outcome_code                                                 AS "outcomeCode",
	COALESCE(outcome_name->>$4::text, outcome_name->>'es', '')   AS "outcomeName",
	level_rank                                                   AS "levelRank",
	cantidad                                                     AS "cantidad",
	total_students                                               AS "totalStudents",
	COALESCE(sede->>$4::text, sede->>'es', '')                   AS "sede",
	ciclo_academico                                              AS "cicloAcademico"
FROM final_rows
WHERE effective_peso = effective_group_max
ORDER BY sede, outcome_code, level_rank, course_code
`;

export const SEMAPHORE_RV_SUMMARY_SQL = `
WITH filtered_outcomes AS (
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
	WHERE it.code = 'TG206-T004'
	  AND pl.academic_period_id = $1::int
	  AND pl.is_active = true
),
scaled_grades AS (
	SELECT
		sse.id AS enrollment_id,
		scog.outcome_id,
		sse.course_section_id,
		CASE
			WHEN NULLIF(scog.extra->>'max_outcome', '')::numeric > 0
				THEN ROUND((scog.grade * 20) / (scog.extra->>'max_outcome')::numeric, 2)
			ELSE scog.grade
		END AS scaled_grade
	FROM evidence.student_course_outcome_grades scog
	JOIN academic.student_section_enrollments sse ON sse.id = scog.student_section_enrollment_id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN evidence.evaluations ev ON ev.id = scog.evaluation_id
	WHERE sse.is_active = true
	  AND es.is_active = true
	  AND ($6::int[] IS NULL OR ev.rubric_id = ANY($6::int[]))
),
classified_grades AS (
	SELECT
		sg.enrollment_id,
		sg.scaled_grade AS grade,
		sg.outcome_id,
		sg.course_section_id,
		lv.level_rank
	FROM scaled_grades sg
	LEFT JOIN levels lv
		ON sg.scaled_grade >= lv.min_score AND sg.scaled_grade <= lv.max_score
),
course_outcome_results AS (
	SELECT
		c.code                                                        AS course_code,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.name                                                     AS sede,
		COUNT(DISTINCT cg.enrollment_id)                              AS total_students,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 1 THEN cg.enrollment_id END) AS students_red,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 2 THEN cg.enrollment_id END) AS students_yellow,
		COUNT(DISTINCT CASE WHEN cg.level_rank = 3 THEN cg.enrollment_id END) AS students_green
	FROM classified_grades cg
	JOIN academic.course_sections cs ON cs.id = cg.course_section_id
	JOIN academic.courses c ON c.id = cs.course_id
	JOIN organization.campuses camp ON camp.id = cs.campus_id
	JOIN filtered_outcomes o ON o.id = cg.outcome_id
	WHERE cs.academic_period_id = $1::int
	  AND ($2::int IS NULL OR o.id = $2::int)
	  AND ($3::int IS NULL OR camp.id = $3::int)
	GROUP BY c.code, o.outcome_code, o.outcome_name, camp.name
),
level_rows AS (
	SELECT course_code, outcome_code, outcome_name, sede, 1 AS level_rank, students_red AS cantidad, total_students FROM course_outcome_results
	UNION ALL
	SELECT course_code, outcome_code, outcome_name, sede, 2 AS level_rank, students_yellow AS cantidad, total_students FROM course_outcome_results
	UNION ALL
	SELECT course_code, outcome_code, outcome_name, sede, 3 AS level_rank, students_green AS cantidad, total_students FROM course_outcome_results
),
weighted_levels AS (
	SELECT
		*,
		ROUND(cantidad::numeric / NULLIF(total_students, 0) * 100, 2) AS porcentaje
	FROM level_rows
),
scored AS (
	SELECT
		*,
		CASE WHEN level_rank = 1 AND porcentaje >= ${CRITICAL_RED_THRESHOLD} THEN 1 ELSE 0 END AS peso
	FROM weighted_levels
),
windowed AS (
	SELECT
		*,
		MAX(peso) OVER ()                                       AS global_max_peso,
		MAX(peso) OVER (PARTITION BY sede, outcome_code)        AS group_max_peso,
		MAX(cantidad) OVER (PARTITION BY sede, outcome_code)    AS group_max_cantidad
	FROM scored
),
final_rows AS (
	SELECT
		*,
		CASE WHEN global_max_peso = 1 THEN peso ELSE cantidad END     AS effective_peso,
		CASE WHEN global_max_peso = 1 THEN group_max_peso ELSE group_max_cantidad END AS effective_group_max,
		ROW_NUMBER() OVER (PARTITION BY sede, outcome_code ORDER BY level_rank ASC) AS row_rank
	FROM windowed
)
SELECT
	outcome_code                                                 AS "outcomeCode",
	COALESCE(outcome_name->>$4::text, outcome_name->>'es', '')   AS "outcomeName",
	level_rank                                                   AS "levelRank",
	cantidad                                                     AS "cantidad",
	total_students                                               AS "totalStudents",
	porcentaje                                                   AS "porcentaje",
	COALESCE(sede->>$4::text, sede->>'es', '')                   AS "sede"
FROM final_rows
WHERE effective_peso = effective_group_max AND row_rank = 1
ORDER BY sede, outcome_code
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
