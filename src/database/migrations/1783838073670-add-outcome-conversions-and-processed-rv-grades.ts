import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOutcomeConversionsAndProcessedRvGrades1783838073670 implements MigrationInterface {
	name = 'AddOutcomeConversionsAndProcessedRvGrades1783838073670';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "accreditation"."outcome_conversions" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}',
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"source_program_commission_id" integer NOT NULL,
				"target_program_commission_id" integer NOT NULL,
				"target_outcome_id" integer NOT NULL,
				"formula" character varying(100) NOT NULL,
				"upload_log_id" integer,
				CONSTRAINT "PK_outcome_conversions" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_outcome_conversions_source_target_outcome"
					UNIQUE ("source_program_commission_id", "target_outcome_id")
			)
		`);

		await queryRunner.query(`
			ALTER TABLE "accreditation"."outcome_conversions"
			ADD CONSTRAINT "FK_outcome_conversions_source_program_commission_id"
			FOREIGN KEY ("source_program_commission_id")
			REFERENCES "accreditation"."program_commissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "accreditation"."outcome_conversions"
			ADD CONSTRAINT "FK_outcome_conversions_target_program_commission_id"
			FOREIGN KEY ("target_program_commission_id")
			REFERENCES "accreditation"."program_commissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "accreditation"."outcome_conversions"
			ADD CONSTRAINT "FK_outcome_conversions_target_outcome_id"
			FOREIGN KEY ("target_outcome_id")
			REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_outcome_conversions_source_program_commission_id"
			ON "accreditation"."outcome_conversions" ("source_program_commission_id")
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_outcome_conversions_target_program_commission_id"
			ON "accreditation"."outcome_conversions" ("target_program_commission_id")
		`);

		await queryRunner.query(`
			CREATE TABLE "academic"."processed_rv_grades" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}',
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"student_section_enrollment_id" integer NOT NULL,
				"outcome_id" integer NOT NULL,
				"evaluation_id" integer NOT NULL,
				"program_commission_id" integer NOT NULL,
				"academic_period_id" integer NOT NULL,
				"course_section_id" integer NOT NULL,
				"grade" numeric(12,6) NOT NULL,
				"scaled_grade" numeric(12,6) NOT NULL,
				"max_outcome" numeric(12,6),
				"performance_level_id" integer,
				"level_rank" integer,
				"is_converted" boolean NOT NULL DEFAULT false,
				"source_program_commission_id" integer,
				"formula" character varying(100),
				"upload_log_id" integer,
				CONSTRAINT "PK_processed_rv_grades" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_processed_rv_grades_enrollment_outcome_evaluation"
					UNIQUE ("student_section_enrollment_id", "outcome_id", "evaluation_id")
			)
		`);

		await queryRunner.query(`
			ALTER TABLE "academic"."processed_rv_grades"
			ADD CONSTRAINT "FK_processed_rv_grades_student_section_enrollment_id"
			FOREIGN KEY ("student_section_enrollment_id")
			REFERENCES "academic"."student_section_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "academic"."processed_rv_grades"
			ADD CONSTRAINT "FK_processed_rv_grades_outcome_id"
			FOREIGN KEY ("outcome_id")
			REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "academic"."processed_rv_grades"
			ADD CONSTRAINT "FK_processed_rv_grades_evaluation_id"
			FOREIGN KEY ("evaluation_id")
			REFERENCES "evidence"."evaluations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "academic"."processed_rv_grades"
			ADD CONSTRAINT "FK_processed_rv_grades_program_commission_id"
			FOREIGN KEY ("program_commission_id")
			REFERENCES "accreditation"."program_commissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "academic"."processed_rv_grades"
			ADD CONSTRAINT "FK_processed_rv_grades_source_program_commission_id"
			FOREIGN KEY ("source_program_commission_id")
			REFERENCES "accreditation"."program_commissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "academic"."processed_rv_grades"
			ADD CONSTRAINT "FK_processed_rv_grades_academic_period_id"
			FOREIGN KEY ("academic_period_id")
			REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "academic"."processed_rv_grades"
			ADD CONSTRAINT "FK_processed_rv_grades_course_section_id"
			FOREIGN KEY ("course_section_id")
			REFERENCES "academic"."course_sections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE "academic"."processed_rv_grades"
			ADD CONSTRAINT "FK_processed_rv_grades_performance_level_id"
			FOREIGN KEY ("performance_level_id")
			REFERENCES "academic"."performance_levels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_processed_rv_grades_period_program_commission"
			ON "academic"."processed_rv_grades" ("academic_period_id", "program_commission_id")
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_processed_rv_grades_course_section_id"
			ON "academic"."processed_rv_grades" ("course_section_id")
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_processed_rv_grades_evaluation_id"
			ON "academic"."processed_rv_grades" ("evaluation_id")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "academic"."processed_rv_grades"`);
		await queryRunner.query(`DROP TABLE "accreditation"."outcome_conversions"`);
	}
}
