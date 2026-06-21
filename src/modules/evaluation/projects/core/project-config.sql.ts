export const CAPSTONE_MAX_LEVEL_VALUE_SQL = `
SELECT MAX(pl.max_value) AS "maxValue"
FROM academic.performance_levels pl
INNER JOIN core.types t ON t.id = pl.instrument_type_id
WHERE t.code = $1
  AND pl.academic_period_id = $2`;

export const RUBRIC_QUESTION_COUNT_SQL = `
SELECT COUNT(*) AS "questionCount"
FROM evaluation.rubric_questions
WHERE rubric_id = $1`;

export const PROGRAM_IDS_BY_SCHOOL_SQL = `
SELECT DISTINCT c_child.entity_code AS "programId"
FROM organization.charts c_school
INNER JOIN organization.charts c_child
ON c_child.root_chart_id = c_school.id
WHERE c_school.entity_type_id = (SELECT id FROM core.types WHERE code = $1)
AND c_school.entity_code = $2
AND c_child.entity_type_id = (SELECT id FROM core.types WHERE code = $3)
AND c_child.entity_code IS NOT NULL`;

export const PROJECT_DUPLICATE_CODE_SQL = `
SELECT p.id AS "id" FROM evaluation.projects p
INNER JOIN evaluation.project_students ps ON ps.project_id = p.id
INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
WHERE p.code = $1 AND cs.academic_period_id = $2
LIMIT 1`;

export const PROJECT_DUPLICATE_NAME_SQL = `
SELECT p.id AS "id" FROM evaluation.projects p
INNER JOIN evaluation.project_students ps ON ps.project_id = p.id
INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
WHERE (p.name->>'es' = $1 OR p.name->>'en' = $2) AND cs.academic_period_id = $3
LIMIT 1`;

export const STUDENT_ALREADY_IN_PROJECT_SQL = `
SELECT ps.id AS "id" FROM evaluation.project_students ps
INNER JOIN evaluation.projects p ON p.id = ps.project_id
INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
WHERE sse.enrolled_student_id = (
	SELECT enrolled_student_id FROM academic.student_section_enrollments WHERE id = $1
)
AND cs.academic_period_id = $2
AND p.is_active = true
LIMIT 1`;

export const COURSE_BASIC_BY_ID_SQL = `
SELECT id, name, description, learning_outcome AS "learningOutcome"
FROM "academic"."courses" WHERE id = $1`;

export const SSE_TO_STUDY_PLAN_COURSE_SQL = `
SELECT
	sse.id AS "sseId",
	spc.id AS "studyPlanCourseId"
FROM academic.student_section_enrollments sse
JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
JOIN academic.study_plan_courses spc
     ON spc.study_plan_academic_period_id = es.study_plan_academic_period
     AND spc.course_id = $1
WHERE sse.id = ANY($2::int[])`;

export const PROGRAM_NAMES_BY_STUDY_PLAN_COURSE_SQL = `
SELECT spc.id AS "spcId", prog.name AS "programName"
FROM academic.study_plan_courses spc
JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
JOIN academic.programs prog ON prog.id = sp.program_id
WHERE spc.id = ANY($1::int[])`;

export const PROJECTS_BY_PROFESSOR_DETAIL_SQL = `
SELECT
	p.id              AS "projectId",
	p.code            AS "projectCode",
	p.name            AS "projectName",
	(
		SELECT MAX(ev.register_at)
		FROM evidence.evaluations ev
		INNER JOIN evaluation.project_students ev_ps ON ev_ps.id = ev.project_student_id
		INNER JOIN evaluation.rubric_scores rs ON rs.evaluation_id = ev.id
		INNER JOIN evaluation.rubric_question_criterias rqc ON rqc.id = rs.rubric_question_criteria_id
		INNER JOIN evaluation.rubric_questions rq ON rq.id = rqc.rubric_question_id
		INNER JOIN evaluation.rubrics r ON r.id = rq.rubric_id
		WHERE ev_ps.project_id = p.id
		AND ($2::int IS NULL OR r.grade_type_id = $2)
	)                 AS "evaluationDate",
	all_pe.id         AS "evalId",
	all_pe.professor_id AS "evalProfessorId",
	COALESCE(all_u.first_name, all_st.first_name, '') AS "evalFirstName",
	COALESCE(all_u.last_name, all_st.last_name, '')   AS "evalLastName",
	all_u.email       AS "evalEmail",
	all_et.name       AS "evalTypeName",
	all_et.code       AS "evalTypeCode",
	ps.id             AS "studentPsId",
	stu.id            AS "studentId",
	COALESCE(stu.first_name, '') AS "stuFirstName",
	COALESCE(stu.last_name, '')  AS "stuLastName",
	stu.email         AS "stuEmail",
	COALESCE(stu.code, '') AS "stuCode",
	c.name            AS "courseName"
FROM evaluation.projects p
LEFT JOIN evaluation.project_evaluators all_pe ON all_pe.project_id = p.id AND all_pe.is_active = true
LEFT JOIN academic.professors all_prof         ON all_prof.id = all_pe.professor_id
LEFT JOIN organization.staff all_st            ON all_st.id = all_prof.staff_id
LEFT JOIN organization.users all_u             ON all_u.id = all_st.user_id
LEFT JOIN core.types all_et                    ON all_et.id = all_pe.evaluator_type_id
LEFT JOIN evaluation.project_students ps       ON ps.project_id = p.id
LEFT JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
LEFT JOIN academic.enrolled_students es        ON es.id = sse.enrolled_student_id
LEFT JOIN academic.students stu                ON stu.id = es.student_id
LEFT JOIN academic.course_sections cs          ON cs.id = sse.course_section_id
LEFT JOIN academic.courses c                   ON c.id = cs.course_id
WHERE p.id = ANY($1::int[])`;

export const PROJECT_GRADES_EXPORT_SQL = `
SELECT
	cs.section_code                           AS "sectionCode",
	c.code                                    AS "courseCode",
	stu.code                                  AS "studentCode",
	CONCAT(stu.first_name, ' ', stu.last_name) AS "studentName",
	r.id                                      AS "rubricId",
	r.rubric_type_id                          AS "rubricTypeId",
	rt.code                                   AS "rubricTypeCode",
	gt.code                                   AS "gradeTypeCode",
	SUM(rs.score)                             AS "totalScore"
FROM evaluation.projects p
INNER JOIN evaluation.project_students ps       ON ps.project_id = p.id
INNER JOIN (
	SELECT DISTINCT ON (ev2.project_student_id) ev2.id, ev2.project_student_id
	FROM evidence.evaluations ev2
	INNER JOIN evaluation.rubric_scores rs2          ON rs2.evaluation_id = ev2.id
	INNER JOIN evaluation.rubric_question_criterias rqc2 ON rqc2.id = rs2.rubric_question_criteria_id
	INNER JOIN evaluation.rubric_questions rq2       ON rq2.id = rqc2.rubric_question_id
	INNER JOIN evaluation.rubrics r2                 ON r2.id = rq2.rubric_id
	WHERE r2.grade_type_id = $2
	ORDER BY ev2.project_student_id, ev2.updated_at DESC NULLS LAST
) ev                                            ON ev.project_student_id = ps.id
INNER JOIN evaluation.rubric_scores rs          ON rs.evaluation_id = ev.id
INNER JOIN evaluation.rubric_question_criterias rqc ON rqc.id = rs.rubric_question_criteria_id
INNER JOIN evaluation.rubric_questions rq       ON rq.id = rqc.rubric_question_id
INNER JOIN evaluation.rubrics r                 ON r.id = rq.rubric_id
INNER JOIN core.types rt                        ON rt.id = r.rubric_type_id
INNER JOIN core.types gt                        ON gt.id = r.grade_type_id
INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
INNER JOIN academic.course_sections cs          ON cs.id = sse.course_section_id
INNER JOIN academic.courses c                   ON c.id = cs.course_id
INNER JOIN academic.enrolled_students es        ON es.id = sse.enrolled_student_id
INNER JOIN academic.students stu                ON stu.id = es.student_id
WHERE cs.academic_period_id = $1
	AND r.grade_type_id = $2
	AND stu.program_id = ANY($3::int[])
GROUP BY
	cs.section_code, c.code, stu.code, stu.first_name, stu.last_name,
	r.id, r.rubric_type_id, rt.code, gt.code
ORDER BY c.code, cs.section_code, stu.last_name, stu.first_name`;
