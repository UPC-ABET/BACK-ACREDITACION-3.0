import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the join-column indexes the student-sections upload (and its per-row uniqueness trigger)
 * rely on. Before this, only primary keys and the unique section_code/student.code existed, so
 * every enrollment/period/plan join in fn_upload_student_sections and in
 * fn_enforce_unique_student_course_period fell back to sequential scans — the dominant cost of the
 * ~8ms/row upload. Paired with the set-based rewrite of the function.
 */
export class AddStudentSectionsUploadIndexes1784093233470 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_enrolled_students_student_id"
			ON "academic"."enrolled_students" ("student_id")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_enrolled_students_study_plan_academic_period_id"
			ON "academic"."enrolled_students" ("study_plan_academic_period_id")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_student_section_enrollments_enrolled_student_id"
			ON "academic"."student_section_enrollments" ("enrolled_student_id", "course_section_id")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_student_section_enrollments_course_section_id"
			ON "academic"."student_section_enrollments" ("course_section_id")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_study_plan_courses_spap_course"
			ON "academic"."study_plan_courses" ("study_plan_academic_period_id", "course_id")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_course_sections_course_period"
			ON "academic"."course_sections" ("course_id", "academic_period_id")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "academic"."IDX_course_sections_course_period"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "academic"."IDX_study_plan_courses_spap_course"`);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "academic"."IDX_student_section_enrollments_course_section_id"`,
		);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "academic"."IDX_student_section_enrollments_enrolled_student_id"`,
		);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "academic"."IDX_enrolled_students_study_plan_academic_period_id"`,
		);
		await queryRunner.query(`DROP INDEX IF EXISTS "academic"."IDX_enrolled_students_student_id"`);
	}
}
