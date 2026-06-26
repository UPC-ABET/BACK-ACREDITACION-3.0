import { MigrationInterface, QueryRunner } from 'typeorm';

export class SimplifyArdSchema1782461525238 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		// Drop dependent tables (ard_comments, ard_attendances depend on ard_meetings/ard_invited_students)
		await queryRunner.query(`DROP TABLE IF EXISTS "evidence"."ard_comments"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "evidence"."ard_attendances"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "evidence"."ard_invited_students"`);

		// Rename ard_meetings to ard (keeping code, meeting_date, campus_id, academic_period_id, and removing school_id, created_by_user_id)
		// Add program_id column
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_meetings" ADD COLUMN "program_id" integer
		`);

		// Create new ard_detail table with combined structure
		await queryRunner.query(`
			CREATE TABLE "evidence"."ard_detail" (
				"id" SERIAL NOT NULL,
				"ard_id" integer NOT NULL,
				"enrollment_student_id" integer,
				"course_id" integer NOT NULL,
				"professor_id" integer NOT NULL,
				"comments" text,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "PK_ard_detail" PRIMARY KEY ("id"),
				CONSTRAINT "FK_ard_detail_ard_id" FOREIGN KEY ("ard_id") 
					REFERENCES "evidence"."ard_meetings"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_ard_detail_enrollment_student_id" FOREIGN KEY ("enrollment_student_id") 
					REFERENCES "academic"."enrolled_students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
				CONSTRAINT "FK_ard_detail_course_id" FOREIGN KEY ("course_id") 
					REFERENCES "academic"."courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
				CONSTRAINT "FK_ard_detail_professor_id" FOREIGN KEY ("professor_id") 
					REFERENCES "academic"."professors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
			)
		`);

		// Create indexes for ard_detail
		await queryRunner.query(`
			CREATE INDEX "IDX_ard_detail_ard_id" ON "evidence"."ard_detail" ("ard_id")
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_ard_detail_enrollment_student_id" ON "evidence"."ard_detail" ("enrollment_student_id")
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_ard_detail_course_id" ON "evidence"."ard_detail" ("course_id")
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_ard_detail_professor_id" ON "evidence"."ard_detail" ("professor_id")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop new ard_detail table
		await queryRunner.query(`DROP TABLE IF EXISTS "evidence"."ard_detail"`);

		// Remove program_id column from ard_meetings
		await queryRunner.query(`
			ALTER TABLE "evidence"."ard_meetings" DROP COLUMN "program_id"
		`);

		// Recreate the original tables (simplified for rollback purposes)
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
				CONSTRAINT "PK_ard_invited_students" PRIMARY KEY ("id"),
				CONSTRAINT "FK_ard_invited_students_ard_meeting_id" FOREIGN KEY ("ard_meeting_id") 
					REFERENCES "evidence"."ard_meetings"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_ard_invited_students_enrolled_student_id" FOREIGN KEY ("enrolled_student_id") 
					REFERENCES "academic"."enrolled_students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
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
				CONSTRAINT "PK_ard_attendances" PRIMARY KEY ("id"),
				CONSTRAINT "FK_ard_attendances_ard_meeting_id" FOREIGN KEY ("ard_meeting_id") 
					REFERENCES "evidence"."ard_meetings"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_ard_attendances_student_section_enrollment_id" FOREIGN KEY ("student_section_enrollment_id") 
					REFERENCES "academic"."student_section_enrollments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
				CONSTRAINT "FK_ard_attendances_ard_invited_student_id" FOREIGN KEY ("ard_invited_student_id") 
					REFERENCES "evidence"."ard_invited_students"("id") ON DELETE CASCADE ON UPDATE NO ACTION
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
				CONSTRAINT "PK_ard_comments" PRIMARY KEY ("id"),
				CONSTRAINT "FK_ard_comments_ard_meeting_id" FOREIGN KEY ("ard_meeting_id") 
					REFERENCES "evidence"."ard_meetings"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_ard_comments_ard_attendance_id" FOREIGN KEY ("ard_attendance_id") 
					REFERENCES "evidence"."ard_attendances"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_ard_comments_course_id" FOREIGN KEY ("course_id") 
					REFERENCES "academic"."courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
				CONSTRAINT "FK_ard_comments_course_section_id" FOREIGN KEY ("course_section_id") 
					REFERENCES "academic"."course_sections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
				CONSTRAINT "FK_ard_comments_professor_id" FOREIGN KEY ("professor_id") 
					REFERENCES "academic"."professors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
			)
		`);

		// Recreate indexes
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
	}
}
