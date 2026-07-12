/**
 * Source outcome grades of one or more evaluations, joined to the commission that owns each
 * outcome. This is the input vector the conversion formulas are evaluated against: the grading
 * flow only ever writes grades for the commission its rubric was authored for, so every other
 * commission's outcomes must be derived from these rows.
 */
export const RV_SOURCE_GRADES_SQL = `
	SELECT
		scog.evaluation_id                   AS "evaluationId",
		scog.student_section_enrollment_id   AS "studentSectionEnrollmentId",
		scog.outcome_id                      AS "outcomeId",
		o.outcome_code                       AS "outcomeCode",
		o.program_commission_id              AS "programCommissionId",
		scog.grade::float                    AS "grade",
		NULLIF(scog.extra->>'max_outcome', '')::float AS "maxOutcome",
		sse.course_section_id                AS "courseSectionId",
		cs.academic_period_id                AS "academicPeriodId"
	FROM evidence.student_course_outcome_grades scog
	JOIN accreditation.outcomes o ON o.id = scog.outcome_id
	JOIN academic.student_section_enrollments sse ON sse.id = scog.student_section_enrollment_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	WHERE scog.evaluation_id = ANY($1::int[])
	  AND sse.is_active = true
	ORDER BY scog.evaluation_id, o.outcome_code
`;

/**
 * RV performance levels for a period, ranked low-to-high. `level_rank` is derived the same way the
 * semaphore report derives it (ORDER BY max_score ASC) so a stored rank always means the same
 * colour band the report would have computed on the fly.
 */
export const RV_PERFORMANCE_LEVELS_SQL = `
	SELECT
		pl.id                                                AS "id",
		pl.min_score::float                                  AS "minScore",
		pl.max_score::float                                  AS "maxScore",
		ROW_NUMBER() OVER (ORDER BY pl.max_score ASC)::int   AS "levelRank"
	FROM academic.performance_levels pl
	JOIN core.types it ON it.id = pl.instrument_type_id
	WHERE it.code = $2::text
	  AND pl.academic_period_id = $1::int
	  AND pl.is_active = true
	ORDER BY pl.max_score ASC
`;

/** Per-student processed RV rows, for the drill-down behind the semaphore aggregates. */
export const RV_PROCESSED_LIST_SQL = `
	SELECT
		prg.id                                            AS "id",
		prg.student_section_enrollment_id                 AS "studentSectionEnrollmentId",
		st.code                                           AS "studentCode",
		CONCAT(st.first_name, ' ', st.last_name)          AS "studentName",
		c.code                                            AS "courseCode",
		o.outcome_code                                    AS "outcomeCode",
		com.code                                          AS "commissionCode",
		prg.grade::float                                  AS "grade",
		prg.scaled_grade::float                           AS "scaledGrade",
		prg.level_rank                                    AS "levelRank",
		COALESCE(pl.name->>$6::text, pl.name->>'es', '')  AS "levelName",
		prg.is_converted                                  AS "isConverted",
		prg.formula                                       AS "formula",
		srccom.code                                       AS "sourceCommissionCode"
	FROM academic.processed_rv_grades prg
	JOIN academic.student_section_enrollments sse ON sse.id = prg.student_section_enrollment_id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id
	JOIN academic.course_sections cs ON cs.id = prg.course_section_id
	JOIN academic.courses c ON c.id = cs.course_id
	JOIN accreditation.outcomes o ON o.id = prg.outcome_id
	JOIN accreditation.program_commissions pc ON pc.id = prg.program_commission_id
	JOIN accreditation.commissions com ON com.id = pc.commission_id
	LEFT JOIN accreditation.program_commissions srcpc ON srcpc.id = prg.source_program_commission_id
	LEFT JOIN accreditation.commissions srccom ON srccom.id = srcpc.commission_id
	LEFT JOIN academic.performance_levels pl ON pl.id = prg.performance_level_id
	WHERE prg.academic_period_id = $1::int
	  AND ($2::int IS NULL OR prg.program_commission_id = $2::int)
	  AND ($3::int IS NULL OR prg.outcome_id = $3::int)
	  AND ($4::int IS NULL OR prg.course_section_id = $4::int)
	  AND ($5::boolean IS NULL OR prg.is_converted = $5::boolean)
	ORDER BY st.code, c.code, o.outcome_code
`;

/** Evaluations in a period that carry outcome grades -- the work list for a full period rebuild. */
export const RV_EVALUATION_IDS_FOR_PERIOD_SQL = `
	SELECT DISTINCT scog.evaluation_id AS "evaluationId"
	FROM evidence.student_course_outcome_grades scog
	JOIN academic.student_section_enrollments sse ON sse.id = scog.student_section_enrollment_id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.course_sections cs ON cs.id = sse.course_section_id
	WHERE cs.academic_period_id = $1::int
	  AND sse.is_active = true
	  AND es.is_active = true
	ORDER BY scog.evaluation_id
`;
