import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArdModule1782523871698 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "evidence"."ard" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"meeting_date" TIMESTAMP WITH TIME ZONE NOT NULL,
				"campus_id" integer NOT NULL,
				"academic_period_id" integer NOT NULL,
				"program_id" integer NOT NULL,
				CONSTRAINT "PK_ard" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`
			CREATE TABLE "evidence"."ard_detail" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"ard_id" integer NOT NULL,
				"enrollment_student_id" integer NOT NULL,
				"course_id" integer NOT NULL,
				"professor_id" integer NOT NULL,
				"comments" jsonb NOT NULL DEFAULT '{}'::jsonb,
				CONSTRAINT "PK_ard_detail" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`
			ALTER TABLE "evidence"."ard"
			ADD CONSTRAINT "FK_ard_academic_period_id"
			FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);

		await queryRunner.query(`
			ALTER TABLE "evidence"."ard"
			ADD CONSTRAINT "FK_ard_campus_id"
			FOREIGN KEY ("campus_id") REFERENCES "organization"."campuses"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);

		await queryRunner.query(`
			ALTER TABLE "evidence"."ard"
			ADD CONSTRAINT "FK_ard_program_id"
			FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);

		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_detail"
			ADD CONSTRAINT "FK_ard_detail_ard_id"
			FOREIGN KEY ("ard_id") REFERENCES "evidence"."ard"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);

		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_detail"
			ADD CONSTRAINT "FK_ard_detail_enrollment_student_id"
			FOREIGN KEY ("enrollment_student_id") REFERENCES "academic"."enrolled_students"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);

		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_detail"
			ADD CONSTRAINT "FK_ard_detail_course_id"
			FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);

		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_detail"
			ADD CONSTRAINT "FK_ard_detail_professor_id"
			FOREIGN KEY ("professor_id") REFERENCES "academic"."professors"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_ard_campus_id" ON "evidence"."ard" ("campus_id")
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_ard_program_id" ON "evidence"."ard" ("program_id")
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_ard_detail_ard_id" ON "evidence"."ard_detail" ("ard_id")
		`);

		await queryRunner.query(`
			CREATE UNIQUE INDEX "UQ_ard_period_meeting_campus_program"
			ON "evidence"."ard" ("academic_period_id", (("meeting_date")::date), "campus_id", "program_id")
		`);

		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_detail"
			ADD CONSTRAINT "UQ_ard_detail_ard_student_course_professor"
			UNIQUE ("ard_id", "enrollment_student_id", "course_id", "professor_id")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX IF EXISTS "evidence"."UQ_ard_period_meeting_campus_program"`,
		);
		await queryRunner.query(`DROP INDEX IF EXISTS "evidence"."IDX_ard_detail_ard_id"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "evidence"."IDX_ard_program_id"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "evidence"."IDX_ard_campus_id"`);
		await queryRunner.query(`DROP TABLE "evidence"."ard_detail"`);
		await queryRunner.query(`DROP TABLE "evidence"."ard"`);
	}
}
