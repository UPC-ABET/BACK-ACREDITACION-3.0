export const SEMAPHORE_RC_SQL = `
WITH weighted_grades AS (
	SELECT
		sse.id AS enrollment_id,
		SUM(scg.grade * scg.grade_type_percentage / 100) AS weighted_average
	FROM academic.student_course_grades scg
	JOIN academic.student_section_enrollments sse ON sse.id = scg.student_section_enrollment_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	WHERE cs.academic_period_id = $1
	GROUP BY sse.id
	HAVING SUM(scg.grade * scg.grade_type_percentage / 100) IS NOT NULL
),
filtered_outcomes AS (
	SELECT id, outcome_code, outcome_name
	FROM accreditation.outcomes
	WHERE is_active = true
	  AND ($6 IS NULL OR program_commission_id = $6)
),
course_outcome_results AS (
	SELECT
		c.id                                                          AS course_id,
		c.code                                                        AS course_code,
		c.name                                                        AS course_name,
		o.id                                                          AS outcome_id,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.name                                                     AS sede,
		ap.code                                                       AS ciclo_academico,
		COUNT(DISTINCT wg.enrollment_id)                              AS total_students,
		COUNT(DISTINCT CASE WHEN wg.weighted_average >= 11 THEN wg.enrollment_id END) AS students_achieved,
		ROUND(
			COUNT(DISTINCT CASE WHEN wg.weighted_average >= 11 THEN wg.enrollment_id END)::numeric
			/ NULLIF(COUNT(DISTINCT wg.enrollment_id), 0) * 100, 2
		)                                                             AS percentage_achieved
	FROM academic.student_course_grades scg
	JOIN academic.student_section_enrollments sse ON sse.id = scg.student_section_enrollment_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	JOIN academic.courses c ON c.id = cs.course_id
	JOIN academic.academic_periods ap ON ap.id = cs.academic_period_id
	JOIN organization.campuses camp ON camp.id = cs.campus_id
	JOIN weighted_grades wg ON wg.enrollment_id = sse.id
	JOIN academic.study_plan_courses spc ON spc.course_id = c.id
	JOIN academic.course_outcome_mappings com ON com.study_plan_course_id = spc.id
	JOIN filtered_outcomes o ON o.id = com.outcome_id
	JOIN core.types ot ON ot.id = com.outcome_type_id
	WHERE cs.academic_period_id = $1
	  AND ot.code = 'TG302-T002'
	  AND ($2 IS NULL OR o.id = $2)
	  AND ($3 IS NULL OR camp.id = $3)
	  AND ($4 IS NULL OR cs.section_modality_type_id = $4)
	GROUP BY c.id, c.code, c.name, o.id, o.outcome_code, o.outcome_name, camp.name, ap.code
)
SELECT
	cor.course_code        AS "courseCode",
	COALESCE(cor.course_name->>$5, cor.course_name->>'es', '') AS "courseName",
	cor.outcome_code       AS "outcomeCode",
	COALESCE(cor.outcome_name->>$5, cor.outcome_name->>'es', '') AS "outcomeName",
	cor.total_students     AS "totalStudents",
	cor.students_achieved  AS "studentsAchieved",
	cor.percentage_achieved AS "percentageAchieved",
	cor.sede               AS "sede",
	cor.ciclo_academico    AS "cicloAcademico",
	COALESCE(st.color, 'AMARILLO') AS "color"
FROM course_outcome_results cor
LEFT JOIN evaluation.semaphore_thresholds st
	ON st.instrument_type_id = (SELECT id FROM core.types WHERE code = 'TG206-T003')
	AND st.is_active = true
	AND (st.academic_period_id IS NULL OR st.academic_period_id = $1)
	AND (st.program_id IS NULL)
	AND cor.percentage_achieved >= st.min_percentage
	AND cor.percentage_achieved <= st.max_percentage
ORDER BY cor.sede, cor.course_code, cor.outcome_code
`;

export const SEMAPHORE_RV_SQL = `
WITH filtered_outcomes AS (
	SELECT id, outcome_code, outcome_name
	FROM accreditation.outcomes
	WHERE is_active = true
	  AND ($6 IS NULL OR program_commission_id = $6)
),
course_outcome_results AS (
	SELECT
		c.id                                                          AS course_id,
		c.code                                                        AS course_code,
		c.name                                                        AS course_name,
		o.id                                                          AS outcome_id,
		o.outcome_code                                                AS outcome_code,
		o.outcome_name                                                AS outcome_name,
		camp.name                                                     AS sede,
		ap.code                                                       AS ciclo_academico,
		COUNT(DISTINCT sse.id)                                        AS total_students,
		COUNT(DISTINCT CASE WHEN scog.grade >= 11 THEN sse.id END)    AS students_achieved,
		ROUND(
			COUNT(DISTINCT CASE WHEN scog.grade >= 11 THEN sse.id END)::numeric
			/ NULLIF(COUNT(DISTINCT sse.id), 0) * 100, 2
		)                                                             AS percentage_achieved
	FROM evidence.student_course_outcome_grades scog
	JOIN academic.student_section_enrollments sse ON sse.id = scog.student_section_enrollment_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	JOIN academic.courses c ON c.id = cs.course_id
	JOIN academic.academic_periods ap ON ap.id = cs.academic_period_id
	JOIN organization.campuses camp ON camp.id = cs.campus_id
	JOIN filtered_outcomes o ON o.id = scog.outcome_id
	WHERE cs.academic_period_id = $1
	  AND ($2 IS NULL OR o.id = $2)
	  AND ($3 IS NULL OR camp.id = $3)
	  AND ($4 IS NULL OR cs.section_modality_type_id = $4)
	GROUP BY c.id, c.code, c.name, o.id, o.outcome_code, o.outcome_name, camp.name, ap.code
)
SELECT
	cor.course_code        AS "courseCode",
	COALESCE(cor.course_name->>$5, cor.course_name->>'es', '') AS "courseName",
	cor.outcome_code       AS "outcomeCode",
	COALESCE(cor.outcome_name->>$5, cor.outcome_name->>'es', '') AS "outcomeName",
	cor.total_students     AS "totalStudents",
	cor.students_achieved  AS "studentsAchieved",
	cor.percentage_achieved AS "percentageAchieved",
	cor.sede               AS "sede",
	cor.ciclo_academico    AS "cicloAcademico",
	COALESCE(st.color, 'AMARILLO') AS "color"
FROM course_outcome_results cor
LEFT JOIN evaluation.semaphore_thresholds st
	ON st.instrument_type_id = (SELECT id FROM core.types WHERE code = 'TG206-T004')
	AND st.is_active = true
	AND (st.academic_period_id IS NULL OR st.academic_period_id = $1)
	AND (st.program_id IS NULL)
	AND cor.percentage_achieved >= st.min_percentage
	AND cor.percentage_achieved <= st.max_percentage
ORDER BY cor.sede, cor.course_code, cor.outcome_code
`;

export const SEMAPHORE_METADATA_SQL = `
WITH target_pc AS (
	SELECT pc.id, pc.program_id, pc.commission_id, pc.academic_period_id
	FROM accreditation.program_commissions pc
	WHERE pc.id = $1 AND pc.is_active = true
)
SELECT
	COALESCE(p.name->>$3, p.name->>'es', '')   AS "programName",
	COALESCE(c.name->>$3, c.name->>'es', '')    AS "commissionName",
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
WHERE ap.id = $2
  AND NOT EXISTS (SELECT 1 FROM target_pc)
LIMIT 1
`;
