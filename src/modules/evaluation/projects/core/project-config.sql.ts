// Each Capstone + Multiple criteria is scored against one of the discrete performance level
// values (unique_value), not the min/max range columns -- see
// EvaluationSubmissionService.getHighestPerformanceLevelValue / aggregateScoresByOutcome, where
// maxOutcome = criteriaCount * this value.
export const PERFORMANCE_LEVEL_UNIQUE_VALUE_MAX_SQL = `
SELECT MAX(pl.unique_value) AS "maxValue"
FROM academic.performance_levels pl
INNER JOIN core.types t ON t.id = pl.instrument_type_id
WHERE t.code = $1
  AND pl.academic_period_id = $2`;

export const SCHOOLS_BY_PROFESSOR_SQL = `
WITH my_projects AS (
	SELECT DISTINCT pe.project_id
	FROM evaluation.project_evaluators pe
	INNER JOIN evaluation.projects proj ON proj.id = pe.project_id
	WHERE pe.professor_id = $1
	  AND pe.is_active = true
	  AND proj.is_active = true
),
project_school_ids AS (
	SELECT DISTINCT ch_sch.entity_code::int AS school_id
	FROM my_projects mpj
	INNER JOIN evaluation.project_students ps ON ps.project_id = mpj.project_id
	INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
	INNER JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	INNER JOIN academic.students stu ON stu.id = es.student_id
	INNER JOIN organization.charts ch_prog
	        ON ch_prog.entity_code = stu.program_id
	       AND ch_prog.entity_type_id = (SELECT id FROM core.types WHERE code = $2)
	INNER JOIN organization.charts ch_sch
	        ON ch_sch.id = ch_prog.root_chart_id
	       AND ch_sch.entity_type_id = (SELECT id FROM core.types WHERE code = $3)
)
SELECT DISTINCT
	sc.id::int         AS "id",
	sc.code            AS "code",
	sc.name            AS "name",
	sc.faculty_id::int AS "facultyId",
	f.code             AS "facultyCode",
	f.name             AS "facultyName"
FROM project_school_ids psid
INNER JOIN organization.schools sc ON sc.id = psid.school_id
LEFT JOIN organization.faculties f ON f.id = sc.faculty_id
WHERE sc.is_active = true
ORDER BY sc.code ASC`;

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
     ON spc.study_plan_academic_period_id = es.study_plan_academic_period_id
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
		AND ($2::int IS NULL OR r.competency_scope_type_id = $2)
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

// Per-student grade for the professor project list: latest evaluation (by updated_at) per
// project_student, summed score of its rubric_scores, plus the rubric's total max score so the
// caller can scale it to 20 for Capstone + Multiple competency rubrics — same rule as
// ProjectDetailsService.computeStudentGrades.
//
// Capstone + Multiple scores each criteria against one of the discrete performance level values
// (unique_value), not a per-criteria min/max range -- rubric_question_criterias.max_value is 0 for
// that rubric type (see EvaluationSubmissionService.aggregateScoresByOutcome). So the max is the
// rubric's academic period's highest performance level unique_value times the *student's own*
// scored-criteria count -- not the whole rubric's criteria count. Capstone + Multiple is graded
// commission-by-commission (EvaluationSubmissionService.submitEvaluation), so a student who
// completed only one of several commissions must be scaled against just that commission's
// criteria, not every commission in the rubric.
export const PROJECT_STUDENT_LATEST_GRADES_SQL = `
WITH latest_eval AS (
	SELECT DISTINCT ON (ev.project_student_id)
		ev.id AS evaluation_id, ev.project_student_id, ev.rubric_id
	FROM evidence.evaluations ev
	INNER JOIN evaluation.project_students ps ON ps.id = ev.project_student_id
	INNER JOIN evaluation.rubrics r            ON r.id = ev.rubric_id
	WHERE ps.project_id = ANY($1::int[])
	  AND ($2::int IS NULL OR r.competency_scope_type_id = $2)
	ORDER BY ev.project_student_id, ev.updated_at DESC
),
score_sums AS (
	SELECT
		le.project_student_id,
		le.rubric_id,
		COALESCE(SUM(rs.score), 0) AS sum_score,
		COUNT(rs.id)               AS score_count
	FROM latest_eval le
	LEFT JOIN evaluation.rubric_scores rs ON rs.evaluation_id = le.evaluation_id
	GROUP BY le.project_student_id, le.rubric_id
),
rubric_period AS (
	SELECT r.id AS rubric_id, spap.academic_period_id
	FROM evaluation.rubrics r
	INNER JOIN academic.study_plan_courses spc ON spc.id = r.study_plan_course_id
	INNER JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
),
perf_level_max AS (
	SELECT pl.academic_period_id, MAX(pl.unique_value) AS max_value
	FROM academic.performance_levels pl
	INNER JOIN core.types t ON t.id = pl.instrument_type_id
	WHERE t.code = $3
	GROUP BY pl.academic_period_id
)
SELECT
	ss.project_student_id                                   AS "studentPsId",
	ss.sum_score                                             AS "sumScore",
	rt.code                                                  AS "rubricTypeCode",
	cst.code                                                 AS "competencyScopeCode",
	COALESCE(plm.max_value, 0) * ss.score_count              AS "totalMaxScore"
FROM score_sums ss
INNER JOIN evaluation.rubrics r ON r.id = ss.rubric_id
INNER JOIN core.types rt        ON rt.id = r.rubric_type_id
INNER JOIN core.types cst       ON cst.id = r.competency_scope_type_id
LEFT JOIN rubric_period rp      ON rp.rubric_id = ss.rubric_id
LEFT JOIN perf_level_max plm    ON plm.academic_period_id = rp.academic_period_id`;

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
	gt.name->>'es'                            AS "gradeTypeName",
	cst.code                                  AS "competencyScopeCode",
	SUM(rs.score)                             AS "totalScore",
	COUNT(rs.id)                              AS "scoreCount"
FROM evaluation.projects p
INNER JOIN evaluation.project_students ps       ON ps.project_id = p.id
INNER JOIN evidence.evaluations ev              ON ev.project_student_id = ps.id
INNER JOIN evaluation.rubrics r                 ON r.id = ev.rubric_id
INNER JOIN evaluation.rubric_scores rs          ON rs.evaluation_id = ev.id
INNER JOIN core.types rt                        ON rt.id = r.rubric_type_id
INNER JOIN core.types gt                        ON gt.id = r.grade_type_id
INNER JOIN core.types cst                       ON cst.id = r.competency_scope_type_id
INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
INNER JOIN academic.course_sections cs          ON cs.id = sse.course_section_id
INNER JOIN academic.courses c                   ON c.id = cs.course_id
INNER JOIN academic.enrolled_students es        ON es.id = sse.enrolled_student_id
INNER JOIN academic.students stu                ON stu.id = es.student_id
WHERE cs.academic_period_id = $1
	AND r.competency_scope_type_id = $2
	AND stu.program_id = ANY($3::int[])
GROUP BY
	cs.section_code, c.code, stu.code, stu.first_name, stu.last_name,
	r.id, r.rubric_type_id, rt.code, gt.code, gt.name, cst.code
ORDER BY c.code, cs.section_code, stu.last_name, stu.first_name`;
