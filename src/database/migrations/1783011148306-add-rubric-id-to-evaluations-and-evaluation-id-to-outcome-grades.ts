import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRubricIdToEvaluationsAndEvaluationIdToOutcomeGrades1783011148306 implements MigrationInterface {
	name = 'AddRubricIdToEvaluationsAndEvaluationIdToOutcomeGrades1783011148306';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE evidence.evaluations
			ADD COLUMN rubric_id integer
		`);

		// Backfill 1: infer the rubric from the evaluation's own scores
		// (rubric_scores -> rubric_question_criterias -> rubric_questions -> rubric_id).
		await queryRunner.query(`
			UPDATE evidence.evaluations ev
			SET rubric_id = sub.rubric_id
			FROM (
				SELECT DISTINCT ON (rs.evaluation_id) rs.evaluation_id, rq.rubric_id
				FROM evaluation.rubric_scores rs
				JOIN evaluation.rubric_question_criterias rqc ON rqc.id = rs.rubric_question_criteria_id
				JOIN evaluation.rubric_questions rq ON rq.id = rqc.rubric_question_id
			) sub
			WHERE sub.evaluation_id = ev.id AND ev.rubric_id IS NULL
		`);

		// Backfill 2: evaluations with no scores yet (e.g. NR/NA with no submitted criteria).
		// Only applied when the project student's course has exactly one active rubric, to avoid
		// guessing wrong when a course already has multiple active rubrics at migration time.
		await queryRunner.query(`
			WITH candidate AS (
				SELECT ps.id AS project_student_id, r.id AS rubric_id
				FROM evaluation.project_students ps
				JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
				JOIN academic.course_sections cs ON cs.id = sse.course_section_id
				JOIN academic.study_plan_courses spc ON spc.course_id = cs.course_id
				JOIN academic.study_plan_academic_periods spap
					ON spap.id = spc.study_plan_academic_period_id
					AND spap.academic_period_id = cs.academic_period_id
				JOIN evaluation.rubrics r ON r.study_plan_course_id = spc.id AND r.is_active = true
			),
			unambiguous AS (
				SELECT project_student_id, MIN(rubric_id) AS rubric_id
				FROM candidate
				GROUP BY project_student_id
				HAVING COUNT(*) = 1
			)
			UPDATE evidence.evaluations ev
			SET rubric_id = u.rubric_id
			FROM unambiguous u
			WHERE u.project_student_id = ev.project_student_id AND ev.rubric_id IS NULL
		`);

		await queryRunner.query(`
			ALTER TABLE evidence.evaluations
			ALTER COLUMN rubric_id SET NOT NULL
		`);

		await queryRunner.query(`
			ALTER TABLE evidence.evaluations
			ADD CONSTRAINT "FK_evaluations_rubric_id" FOREIGN KEY (rubric_id)
			REFERENCES evaluation.rubrics(id) ON DELETE NO ACTION ON UPDATE NO ACTION
		`);

		await queryRunner.query(`
			ALTER TABLE evidence.student_course_outcome_grades
			ADD COLUMN evaluation_id integer
		`);

		// Backfill: trace each (student_section_enrollment_id, outcome_id) grade back to the
		// evaluation that produced it. Every row here today comes from the rubric-scoring flow
		// (no RV/RC bulk upload has written to this table yet).
		await queryRunner.query(`
			UPDATE evidence.student_course_outcome_grades scog
			SET evaluation_id = sub.evaluation_id
			FROM (
				SELECT DISTINCT ON (ps.student_section_enrollment_id, rq.outcome_id)
					ps.student_section_enrollment_id,
					rq.outcome_id,
					ev.id AS evaluation_id
				FROM evidence.evaluations ev
				JOIN evaluation.project_students ps ON ps.id = ev.project_student_id
				JOIN evaluation.rubric_questions rq ON rq.rubric_id = ev.rubric_id
				WHERE rq.outcome_id IS NOT NULL
			) sub
			WHERE sub.student_section_enrollment_id = scog.student_section_enrollment_id
				AND sub.outcome_id = scog.outcome_id
				AND scog.evaluation_id IS NULL
		`);

		await queryRunner.query(`
			ALTER TABLE evidence.student_course_outcome_grades
			ALTER COLUMN evaluation_id SET NOT NULL
		`);

		await queryRunner.query(`
			ALTER TABLE evidence.student_course_outcome_grades
			ADD CONSTRAINT "FK_student_course_outcome_grades_evaluation_id" FOREIGN KEY (evaluation_id)
			REFERENCES evidence.evaluations(id) ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE evidence.student_course_outcome_grades
			DROP CONSTRAINT "FK_student_course_outcome_grades_evaluation_id"
		`);

		await queryRunner.query(`
			ALTER TABLE evidence.student_course_outcome_grades
			DROP COLUMN evaluation_id
		`);

		await queryRunner.query(`
			ALTER TABLE evidence.evaluations
			DROP CONSTRAINT "FK_evaluations_rubric_id"
		`);

		await queryRunner.query(`
			ALTER TABLE evidence.evaluations
			DROP COLUMN rubric_id
		`);
	}
}
