import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArdModule1782272642500 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "evidence"."ard_meetings" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"code" character varying(50) NOT NULL,
				"meeting_date" TIMESTAMP WITH TIME ZONE NOT NULL,
				"academic_period_id" integer NOT NULL,
				"campus_id" integer NOT NULL,
				"school_id" integer NOT NULL,
				"created_by_user_id" integer NOT NULL,
				CONSTRAINT "UQ_ard_meetings_code" UNIQUE ("code"),
				CONSTRAINT "PK_ard_meetings" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`
			CREATE TABLE "evidence"."ard_invited_students" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"ard_meeting_id" integer NOT NULL,
				"enrolled_student_id" integer NOT NULL,
				CONSTRAINT "UQ_ard_invited_students_meeting_enrolled_student" UNIQUE ("ard_meeting_id", "enrolled_student_id"),
				CONSTRAINT "PK_ard_invited_students" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`
			CREATE TABLE "evidence"."ard_attendances" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"ard_meeting_id" integer NOT NULL,
				"student_section_enrollment_id" integer,
				"ard_invited_student_id" integer,
				CONSTRAINT "CK_ard_attendances_one_participant" CHECK (
					("student_section_enrollment_id" IS NOT NULL AND "ard_invited_student_id" IS NULL)
					OR ("student_section_enrollment_id" IS NULL AND "ard_invited_student_id" IS NOT NULL)
				),
				CONSTRAINT "UQ_ard_attendances_representative" UNIQUE ("ard_meeting_id", "student_section_enrollment_id"),
				CONSTRAINT "UQ_ard_attendances_guest" UNIQUE ("ard_meeting_id", "ard_invited_student_id"),
				CONSTRAINT "PK_ard_attendances" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`
			CREATE TABLE "evidence"."ard_comments" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"code" character varying(50) NOT NULL,
				"ard_meeting_id" integer NOT NULL,
				"ard_attendance_id" integer NOT NULL,
				"course_id" integer NOT NULL,
				"course_section_id" integer NOT NULL,
				"professor_id" integer NOT NULL,
				"description" jsonb NOT NULL DEFAULT '{}'::jsonb,
				CONSTRAINT "UQ_ard_comments_code" UNIQUE ("code"),
				CONSTRAINT "PK_ard_comments" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(
			`CREATE INDEX "IDX_ard_meetings_academic_period_id" ON "evidence"."ard_meetings" ("academic_period_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ard_meetings_campus_id" ON "evidence"."ard_meetings" ("campus_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ard_meetings_school_id" ON "evidence"."ard_meetings" ("school_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ard_meetings_meeting_date" ON "evidence"."ard_meetings" ("meeting_date")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ard_invited_students_ard_meeting_id" ON "evidence"."ard_invited_students" ("ard_meeting_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ard_invited_students_enrolled_student_id" ON "evidence"."ard_invited_students" ("enrolled_student_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ard_attendances_ard_meeting_id" ON "evidence"."ard_attendances" ("ard_meeting_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ard_attendances_student_section_enrollment_id" ON "evidence"."ard_attendances" ("student_section_enrollment_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ard_attendances_ard_invited_student_id" ON "evidence"."ard_attendances" ("ard_invited_student_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ard_comments_ard_meeting_id" ON "evidence"."ard_comments" ("ard_meeting_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ard_comments_ard_attendance_id" ON "evidence"."ard_comments" ("ard_attendance_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ard_comments_course_section_id" ON "evidence"."ard_comments" ("course_section_id")`,
		);

		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_meetings"
			ADD CONSTRAINT "FK_ard_meetings_academic_period_id"
			FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_meetings"
			ADD CONSTRAINT "FK_ard_meetings_campus_id"
			FOREIGN KEY ("campus_id") REFERENCES "organization"."campuses"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_meetings"
			ADD CONSTRAINT "FK_ard_meetings_school_id"
			FOREIGN KEY ("school_id") REFERENCES "organization"."schools"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_meetings"
			ADD CONSTRAINT "FK_ard_meetings_created_by_user_id"
			FOREIGN KEY ("created_by_user_id") REFERENCES "organization"."users"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_invited_students"
			ADD CONSTRAINT "FK_ard_invited_students_ard_meeting_id"
			FOREIGN KEY ("ard_meeting_id") REFERENCES "evidence"."ard_meetings"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_invited_students"
			ADD CONSTRAINT "FK_ard_invited_students_enrolled_student_id"
			FOREIGN KEY ("enrolled_student_id") REFERENCES "academic"."enrolled_students"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_attendances"
			ADD CONSTRAINT "FK_ard_attendances_ard_meeting_id"
			FOREIGN KEY ("ard_meeting_id") REFERENCES "evidence"."ard_meetings"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_attendances"
			ADD CONSTRAINT "FK_ard_attendances_student_section_enrollment_id"
			FOREIGN KEY ("student_section_enrollment_id") REFERENCES "academic"."student_section_enrollments"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_attendances"
			ADD CONSTRAINT "FK_ard_attendances_ard_invited_student_id"
			FOREIGN KEY ("ard_invited_student_id") REFERENCES "evidence"."ard_invited_students"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_comments"
			ADD CONSTRAINT "FK_ard_comments_ard_meeting_id"
			FOREIGN KEY ("ard_meeting_id") REFERENCES "evidence"."ard_meetings"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_comments"
			ADD CONSTRAINT "FK_ard_comments_ard_attendance_id"
			FOREIGN KEY ("ard_attendance_id") REFERENCES "evidence"."ard_attendances"("id")
			ON DELETE CASCADE ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_comments"
			ADD CONSTRAINT "FK_ard_comments_course_id"
			FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_comments"
			ADD CONSTRAINT "FK_ard_comments_course_section_id"
			FOREIGN KEY ("course_section_id") REFERENCES "academic"."course_sections"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_comments"
			ADD CONSTRAINT "FK_ard_comments_professor_id"
			FOREIGN KEY ("professor_id") REFERENCES "academic"."professors"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_comments" DROP CONSTRAINT "FK_ard_comments_professor_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_comments" DROP CONSTRAINT "FK_ard_comments_course_section_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_comments" DROP CONSTRAINT "FK_ard_comments_course_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_comments" DROP CONSTRAINT "FK_ard_comments_ard_attendance_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_comments" DROP CONSTRAINT "FK_ard_comments_ard_meeting_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_attendances" DROP CONSTRAINT "FK_ard_attendances_ard_invited_student_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_attendances" DROP CONSTRAINT "FK_ard_attendances_student_section_enrollment_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_attendances" DROP CONSTRAINT "FK_ard_attendances_ard_meeting_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_invited_students" DROP CONSTRAINT "FK_ard_invited_students_enrolled_student_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_invited_students" DROP CONSTRAINT "FK_ard_invited_students_ard_meeting_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_meetings" DROP CONSTRAINT "FK_ard_meetings_created_by_user_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_meetings" DROP CONSTRAINT "FK_ard_meetings_school_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_meetings" DROP CONSTRAINT "FK_ard_meetings_campus_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ard_meetings" DROP CONSTRAINT "FK_ard_meetings_academic_period_id"`,
		);

		await queryRunner.query(`DROP INDEX "evidence"."IDX_ard_comments_course_section_id"`);
		await queryRunner.query(`DROP INDEX "evidence"."IDX_ard_comments_ard_attendance_id"`);
		await queryRunner.query(`DROP INDEX "evidence"."IDX_ard_comments_ard_meeting_id"`);
		await queryRunner.query(`DROP INDEX "evidence"."IDX_ard_attendances_ard_invited_student_id"`);
		await queryRunner.query(
			`DROP INDEX "evidence"."IDX_ard_attendances_student_section_enrollment_id"`,
		);
		await queryRunner.query(`DROP INDEX "evidence"."IDX_ard_attendances_ard_meeting_id"`);
		await queryRunner.query(`DROP INDEX "evidence"."IDX_ard_invited_students_enrolled_student_id"`);
		await queryRunner.query(`DROP INDEX "evidence"."IDX_ard_invited_students_ard_meeting_id"`);
		await queryRunner.query(`DROP INDEX "evidence"."IDX_ard_meetings_meeting_date"`);
		await queryRunner.query(`DROP INDEX "evidence"."IDX_ard_meetings_school_id"`);
		await queryRunner.query(`DROP INDEX "evidence"."IDX_ard_meetings_campus_id"`);
		await queryRunner.query(`DROP INDEX "evidence"."IDX_ard_meetings_academic_period_id"`);

		await queryRunner.query(`DROP TABLE "evidence"."ard_comments"`);
		await queryRunner.query(`DROP TABLE "evidence"."ard_attendances"`);
		await queryRunner.query(`DROP TABLE "evidence"."ard_invited_students"`);
		await queryRunner.query(`DROP TABLE "evidence"."ard_meetings"`);
	}
}
