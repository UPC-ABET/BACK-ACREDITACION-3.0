import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Adds the two "reused by another upload" guards to fn_rollback_grades_rv that every other
 * cascade-creating bulk upload already has (fn_rollback_rubrics, fn_rollback_projects): if this
 * upload's rubric structure or project was found-and-reused (not recreated) by a later RV upload,
 * block the rollback instead of deleting rows a later upload still depends on.
 *
 * Unlike rubrics/projects (which never create rubric_scores/evaluations themselves), RV creates
 * both the shared parent (rubric/project) and the child that references it (rubric_scores/
 * evaluations) in the same run, so the guard needs "IS DISTINCT FROM p_upload_log_id" to avoid
 * blocking on the upload's own rows.
 */
export class GuardGradesRvRollbackReuse1783070000000 implements MigrationInterface {
	name = 'GuardGradesRvRollbackReuse1783070000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_grades_rv(p_upload_log_id integer)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- Block if this upload's rubric structure was reused (found, not recreated) by grades
	-- recorded in a later upload.
	IF EXISTS (
		SELECT 1
		FROM evaluation.rubric_scores rs
		JOIN evaluation.rubric_question_criterias rqc ON rqc.id = rs.rubric_question_criteria_id
		WHERE rqc.upload_log_id = p_upload_log_id
		  AND rs.upload_log_id IS DISTINCT FROM p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedEvaluations';
	END IF;

	-- Block if this upload's project was reused (shared) by another student evaluated in a
	-- later upload.
	IF EXISTS (
		SELECT 1
		FROM evidence.evaluations ev
		JOIN evaluation.project_students ps ON ps.id = ev.project_student_id
		JOIN evaluation.projects p ON p.id = ps.project_id
		WHERE p.upload_log_id = p_upload_log_id
		  AND ev.upload_log_id IS DISTINCT FROM p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedEvaluations';
	END IF;

	-- Delete in reverse cascade order so FK constraints are respected
	DELETE FROM evidence.student_course_outcome_grades WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.rubric_scores                WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evidence.evaluations                    WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.project_evaluators           WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.project_students             WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.projects                     WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.rubric_question_criterias    WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.rubric_questions             WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.rubrics                      WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at    = NOW(),
	    updated_at     = NOW()
	WHERE id = p_upload_log_id;
END;
$fn$;
`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Restore the previous fn_rollback_grades_rv (from migration 1783060000000), without the guards.
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_grades_rv(p_upload_log_id integer)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- Delete in reverse cascade order so FK constraints are respected
	DELETE FROM evidence.student_course_outcome_grades WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.rubric_scores                WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evidence.evaluations                    WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.project_evaluators           WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.project_students             WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.projects                     WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.rubric_question_criterias    WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.rubric_questions             WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.rubrics                      WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at    = NOW(),
	    updated_at     = NOW()
	WHERE id = p_upload_log_id;
END;
$fn$;
`);
	}
}
