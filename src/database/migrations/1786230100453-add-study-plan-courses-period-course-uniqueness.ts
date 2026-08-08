import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * A course can only appear once in a given study plan's offering for a given academic period.
 * Nothing enforced this at the database level — only application validation
 * (StudyPlanCourseValidation.validateCreate/validateUpdate/validateMaintenanceCreate) and the
 * upload path (fn_upload_study_plans' courseAlreadyInStudyPlan check) kept it 1:1. A query that
 * joins through study_plan_courses to filter by program (e.g. CourseSectionRepository's
 * programId filter) silently depends on that invariant holding — this constraint hardens it at
 * the schema level, matching the same treatment study_plan_academic_periods already got in
 * 1782450894117-study-plan-identity-by-program-period.ts.
 *
 * Forward-only in production: down() drops the constraint.
 */
export class AddStudyPlanCoursesPeriodCourseUniqueness1786230100453 implements MigrationInterface {
	name = 'AddStudyPlanCoursesPeriodCourseUniqueness1786230100453';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_courses" ADD CONSTRAINT "UQ_study_plan_courses_period_course" UNIQUE ("study_plan_academic_period_id", "course_id")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_courses" DROP CONSTRAINT "UQ_study_plan_courses_period_course"`,
		);
	}
}
