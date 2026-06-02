import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1700000000000 implements MigrationInterface {
	name = 'InitialMigration1700000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "academic"`);
		await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "accreditation"`);
		await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "organization"`);
		await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "evidence"`);
		await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "survey"`);
		await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "improvement"`);
		await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "ifc"`);
		await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "evaluation"`);
		await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "core"`);
		await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "audit"`);
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "typeorm_metadata" ("type" varchar NOT NULL, "database" varchar, "schema" varchar, "table" varchar, "name" varchar, "value" text)`,
		);
		await queryRunner.query(
			`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				queryRunner.connection.options.database,
				'academic',
				'academic_periods',
				'GENERATED_COLUMN',
				'year',
				`EXTRACT(YEAR FROM ("start_date" AT TIME ZONE 'UTC'))::int`,
			],
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."academic_periods" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "modality_type_id" integer NOT NULL, "code" character varying(255) NOT NULL, "start_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "end_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "year" integer GENERATED ALWAYS AS (EXTRACT(YEAR FROM ("start_date" AT TIME ZONE 'UTC'))::int) STORED NOT NULL, CONSTRAINT "PK_academic_periods" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_academic_periods_year" ON "academic"."academic_periods" ("year")`,
		);
		await queryRunner.query(
			`CREATE TABLE "accreditation"."accreditors" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(255) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_accreditors" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "accreditation"."commissions" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "accreditor_id" integer NOT NULL, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_commissions_code" UNIQUE ("code"), CONSTRAINT "PK_commissions" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."programs" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "modality_type_id" integer NOT NULL, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "degree" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_programs_code" UNIQUE ("code"), CONSTRAINT "PK_programs" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "accreditation"."program_commissions" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "commission_id" integer NOT NULL, "program_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "commission_type_id" integer NOT NULL, CONSTRAINT "PK_program_commissions" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "accreditation"."outcomes" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "program_commission_id" integer NOT NULL, "outcome_code" character varying(50) NOT NULL, "outcome_name" jsonb NOT NULL DEFAULT '{}'::jsonb, "outcome_description" jsonb NOT NULL DEFAULT '{}'::jsonb, "upload_log_id" integer, CONSTRAINT "UQ_outcomes_outcome_code" UNIQUE ("outcome_code"), CONSTRAINT "PK_outcomes" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."campuses" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(255) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_campuses" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."users" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "document_type_id" integer NOT NULL, "document_code" integer NOT NULL, "first_name" character varying(255) NOT NULL, "last_name" character varying(255) NOT NULL, "email" character varying(254) NOT NULL, "phone" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "is_admin" boolean DEFAULT false, CONSTRAINT "PK_users" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."staff" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "user_id" integer NOT NULL, "position_type_id" integer NOT NULL, "job_title" jsonb NOT NULL DEFAULT '{}'::jsonb, "job_description" jsonb NOT NULL DEFAULT '{}'::jsonb, "staff_email" character varying(255) NOT NULL, "staff_phone" character varying(255) NOT NULL, "upload_log_id" integer, CONSTRAINT "PK_staff" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."professors" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "staff_id" integer NOT NULL, "code" character varying(50) NOT NULL, "upload_log_id" integer, CONSTRAINT "UQ_professors_code" UNIQUE ("code"), CONSTRAINT "PK_professors" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "audit"."upload_logs" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "user_id" integer NOT NULL, "academic_period_id" integer, "upload_type_id" integer NOT NULL, "status_type_id" integer NOT NULL, "source_file" text, "total_rows" integer, "loaded_rows" integer, "error_rows" integer, "rollback_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_upload_logs" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_upload_logs_type_created" ON "audit"."upload_logs" ("upload_type_id", "created_at")`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."courses" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb NOT NULL DEFAULT '{}'::jsonb, "learning_outcome" jsonb NOT NULL DEFAULT '{}'::jsonb, "upload_log_id" integer, CONSTRAINT "UQ_courses_code" UNIQUE ("code"), CONSTRAINT "PK_courses" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."study_plans" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "program_id" integer NOT NULL, "code" character varying(10) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb NOT NULL DEFAULT '{}'::jsonb, "upload_log_id" integer, CONSTRAINT "UQ_study_plans_code" UNIQUE ("code"), CONSTRAINT "PK_study_plans" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."study_plan_academic_periods" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "study_plan_id" integer NOT NULL, "academic_period_id" integer NOT NULL, CONSTRAINT "PK_study_plan_academic_periods" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."study_plan_courses" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "study_plan_academic_period_id" integer NOT NULL, "course_id" integer NOT NULL, "is_elective" boolean NOT NULL DEFAULT false, "level_type_id" integer NOT NULL, "upload_log_id" integer, CONSTRAINT "PK_study_plan_courses" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."course_sections" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "course_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "campus_id" integer NOT NULL, "professor_id" integer NOT NULL, "section_code" character varying(50) NOT NULL, "schedule" jsonb DEFAULT '{}'::jsonb, "section_modality_type_id" integer NOT NULL, "upload_log_id" integer, CONSTRAINT "UQ_course_sections_section_code" UNIQUE ("section_code"), CONSTRAINT "PK_course_sections" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."students" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "user_id" integer NOT NULL, "program_id" integer NOT NULL, "graduation_modality_type_id" integer NOT NULL, "code" character varying(50) NOT NULL, "upload_log_id" integer, CONSTRAINT "UQ_students_code" UNIQUE ("code"), CONSTRAINT "PK_students" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evidence"."surveys" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "survey_type_id" integer NOT NULL, "survey_status_type_id" integer NOT NULL, "student_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "campus_id" integer NOT NULL, "program_id" integer NOT NULL, "information" jsonb DEFAULT '{}'::jsonb, "survey_number" integer, "course_section_id" integer NOT NULL, CONSTRAINT "PK_surveys" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "survey"."scores" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "survey_id" integer NOT NULL, "outcome_id" integer NOT NULL, "score" numeric(12,6) NOT NULL, "commentaries" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "PK_scores" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "survey"."outcome_configs" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "outcome_id" integer NOT NULL, "user_outcome_name" jsonb NOT NULL DEFAULT '{}'::jsonb, "user_outcome_description" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "PK_outcome_configs" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "survey"."notifications" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "survey_id" integer NOT NULL, "notification_status_type_id" integer NOT NULL, "token" text NOT NULL, "sent_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "max_register_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_notifications" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "survey"."notification_messages" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "survey_type_id" integer NOT NULL, "program_id" integer NOT NULL, "title" jsonb NOT NULL DEFAULT '{}'::jsonb, "body" jsonb NOT NULL DEFAULT '{}'::jsonb, "cc_receivers" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "PK_notification_messages" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."faculties" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_faculties_code" UNIQUE ("code"), CONSTRAINT "PK_faculties" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."schools" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "faculty_id" integer NOT NULL, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_schools_code" UNIQUE ("code"), CONSTRAINT "PK_schools" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."charts" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "staff_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "level_type_id" integer NOT NULL, "root_chart_id" integer, "title" jsonb NOT NULL DEFAULT '{}'::jsonb, "entity_type_id" integer, "entity_code" integer, "upload_log_id" integer, CONSTRAINT "PK_charts" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "improvement"."plans" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "program_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb DEFAULT '{}'::jsonb, "is_open" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_plans" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "improvement"."actions" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "description" jsonb NOT NULL DEFAULT '{}'::jsonb, "correlative" integer NOT NULL, "program_id" integer NOT NULL, "academic_period_id" integer NOT NULL, CONSTRAINT "PK_actions" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evidence"."instruments" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "constituent_type_id" integer NOT NULL, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb DEFAULT '{}'::jsonb, "is_for_accreditation" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_instruments_code" UNIQUE ("code"), CONSTRAINT "PK_instruments" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "improvement"."findings" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "criticality_type_id" integer NOT NULL, "instrument_id" integer NOT NULL, "staff_id" integer, "correlative" integer NOT NULL, "description" jsonb DEFAULT '{}'::jsonb, "course_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "campus_id" integer, "is_automatic" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_findings" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_findings_course_period" ON "improvement"."findings" ("course_id", "academic_period_id")`,
		);
		await queryRunner.query(
			`CREATE TABLE "improvement"."finding_actions" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "finding_id" integer NOT NULL, "action_id" integer NOT NULL, "in_plan_required" boolean NOT NULL DEFAULT false, "evidences" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "PK_finding_actions" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "improvement"."plan_actions" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "plan_id" integer NOT NULL, "finding_action_id" integer NOT NULL, CONSTRAINT "PK_plan_actions" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "improvement"."finding_outcomes" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "finding_id" integer NOT NULL, "outcome_id" integer NOT NULL, CONSTRAINT "PK_finding_outcomes" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evidence"."ifcs" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "course_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "information" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "PK_ifcs" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ifcs_course_period" ON "evidence"."ifcs" ("course_id", "academic_period_id")`,
		);
		await queryRunner.query(
			`CREATE TABLE "ifc"."statuses" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "ifc_id" integer NOT NULL, "status_type_id" integer NOT NULL, "staff_id" integer NOT NULL, "comment" jsonb DEFAULT '{}'::jsonb, "register_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_statuses" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "ifc"."ifc_findings" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "ifc_id" integer NOT NULL, "finding_id" integer NOT NULL, CONSTRAINT "PK_ifc_findings" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "ifc"."notification_configs" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "school_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "trigger_type_id" integer NOT NULL, "ifc_status_type_id" integer NOT NULL, "title" jsonb NOT NULL DEFAULT '{}'::jsonb, "body" jsonb NOT NULL DEFAULT '{}'::jsonb, "to_chart_level_type_ids" jsonb NOT NULL DEFAULT '[]', "cc_chart_level_type_ids" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "PK_notification_configs" PRIMARY KEY ("id"), CONSTRAINT "UQ_notification_configs_school_period_trigger_status" UNIQUE ("school_id", "academic_period_id", "trigger_type_id", "ifc_status_type_id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "ifc"."notification_logs" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "ifc_id" integer NULL, "chart_id" integer NOT NULL, "notification_config_id" integer NOT NULL, "notifier_user_id" integer NULL, "to_staff_ids" jsonb NOT NULL DEFAULT '[]', "cc_staff_ids" jsonb NOT NULL DEFAULT '[]', "provider_message_id" character varying(254) NULL, CONSTRAINT "PK_notification_logs" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_notification_logs_ifc_id" ON "ifc"."notification_logs" ("ifc_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_notification_logs_chart_id" ON "ifc"."notification_logs" ("chart_id")`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."enrolled_students" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "student_id" integer NOT NULL, "study_plan_academic_period" integer NOT NULL, "campus_id" integer NOT NULL, "enrollement_modality_type_id" integer NOT NULL, "upload_log_id" integer, CONSTRAINT "PK_enrolled_students" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."student_section_enrollments" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "enrolled_student_id" integer NOT NULL, "course_section_id" integer NOT NULL, "upload_log_id" integer, CONSTRAINT "PK_student_section_enrollments" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evidence"."student_course_outcome_grades" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "student_section_enrollment_id" integer NOT NULL, "outcome_id" integer NOT NULL, "grade" numeric(12,6) NOT NULL, "upload_log_id" integer, CONSTRAINT "PK_student_course_outcome_grades" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."projects" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "UQ_projects_code" UNIQUE ("code"), CONSTRAINT "PK_projects" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."project_evaluators" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "project_id" integer NOT NULL, "professor_id" integer NOT NULL, "evaluator_type_id" integer NOT NULL, CONSTRAINT "PK_project_evaluators" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."project_students" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "project_id" integer NOT NULL, "student_section_enrollment_id" integer NOT NULL, CONSTRAINT "PK_project_students" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evidence"."evaluations" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "project_student_id" integer NOT NULL, "project_evaluator_id" integer NOT NULL, "qualification_status_type_id" integer NOT NULL, "observation" jsonb DEFAULT '{}'::jsonb, "register_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "PK_evaluations" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."rubrics" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "rubric_type_id" integer NOT NULL, "grade_type_id" integer NOT NULL, "study_plan_course_id" integer NOT NULL, CONSTRAINT "PK_rubrics" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."rubric_question_criterias" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "rubric_question_id" integer NOT NULL, "criteria" jsonb NOT NULL DEFAULT '{}'::jsonb, "min_value" numeric(12,6) NOT NULL, "max_value" numeric(12,6) NOT NULL, CONSTRAINT "PK_rubric_question_criterias" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."rubric_scores" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "evaluation_id" integer NOT NULL, "rubric_question_criteria_id" integer NOT NULL, "score" numeric(12,6) NOT NULL, "commentaries" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "PK_rubric_scores" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."rubric_questions" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "rubric_id" integer NOT NULL, "outcome_id" integer, "question" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_rubric_questions" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "core"."type_groups" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "UQ_type_groups_code" UNIQUE ("code"), CONSTRAINT "PK_type_groups" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "core"."types" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "type_group_id" integer NOT NULL, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "UQ_types_code" UNIQUE ("code"), CONSTRAINT "PK_types" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "core"."parameters" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb DEFAULT '{}'::jsonb, "value" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "UQ_parameters_code" UNIQUE ("code"), CONSTRAINT "PK_parameters" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."student_course_grades" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "student_section_enrollment_id" integer NOT NULL, "grade_type_id" integer NOT NULL, "grade_type_percentage" numeric(12,6) NOT NULL, "grade" numeric(12,6) NOT NULL, "upload_log_id" integer, CONSTRAINT "PK_student_course_grades" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."performance_levels" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "instrument_type_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "code" character varying(50) NOT NULL, "unique_value" numeric(12,6) NOT NULL, "min_score" numeric(12,6) NOT NULL, "max_score" numeric(12,6) NOT NULL, "max_value" numeric(12,6) NOT NULL, CONSTRAINT "UQ_performance_levels_code" UNIQUE ("code"), CONSTRAINT "PK_performance_levels" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."course_outcome_mappings" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "outcome_id" integer NOT NULL, "study_plan_course_id" integer NOT NULL, "outcome_type_id" integer NOT NULL, "upload_log_id" integer, CONSTRAINT "PK_course_outcome_mappings" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "core"."roles" ("id" SERIAL NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "code" character varying(50) NOT NULL, "description" jsonb DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_roles_code" UNIQUE ("code"), CONSTRAINT "PK_roles" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(`
			DO $$
			BEGIN
				IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'root') THEN
					EXECUTE 'ALTER TABLE "core"."roles" OWNER TO root';
				END IF;
			END $$;
		`);
		await queryRunner.query(
			`CREATE TABLE "core"."user_roles" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "role_id" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_user_roles_user_role" UNIQUE ("user_id", "role_id"), CONSTRAINT "PK_user_roles" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(`
			DO $$
			BEGIN
				IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'root') THEN
					EXECUTE 'ALTER TABLE "core"."user_roles" OWNER TO root';
				END IF;
			END $$;
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_user_roles_user_active" ON "core"."user_roles" ("user_id", "is_active")`,
		);
		await queryRunner.query(
			`CREATE TABLE "core"."role_module_permissions" ("id" SERIAL NOT NULL, "role_id" integer NOT NULL, "module_type_id" integer NOT NULL, "permission_type_id" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_role_module_permission" UNIQUE ("role_id", "module_type_id", "permission_type_id"), CONSTRAINT "PK_role_module_permissions" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(`
			DO $$
			BEGIN
				IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'root') THEN
					EXECUTE 'ALTER TABLE "core"."role_module_permissions" OWNER TO root';
				END IF;
			END $$;
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_role_module_permissions_lookup" ON "core"."role_module_permissions" ("role_id", "module_type_id", "permission_type_id", "is_active")`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."commissions" ADD CONSTRAINT "FK_commissions_accreditor_id" FOREIGN KEY ("accreditor_id") REFERENCES "accreditation"."accreditors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."program_commissions" ADD CONSTRAINT "FK_program_commissions_commission_id" FOREIGN KEY ("commission_id") REFERENCES "accreditation"."commissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."program_commissions" ADD CONSTRAINT "FK_program_commissions_program_id" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."program_commissions" ADD CONSTRAINT "FK_program_commissions_academic_period_id" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."outcomes" ADD CONSTRAINT "FK_outcomes_program_commission_id" FOREIGN KEY ("program_commission_id") REFERENCES "accreditation"."program_commissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."staff" ADD CONSTRAINT "FK_staff_user_id" FOREIGN KEY ("user_id") REFERENCES "organization"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."professors" ADD CONSTRAINT "FK_professors_staff_id" FOREIGN KEY ("staff_id") REFERENCES "organization"."staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "audit"."upload_logs" ADD CONSTRAINT "FK_upload_logs_user_id" FOREIGN KEY ("user_id") REFERENCES "organization"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "audit"."upload_logs" ADD CONSTRAINT "FK_upload_logs_academic_period_id" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "audit"."upload_logs" ADD CONSTRAINT "FK_upload_logs_upload_type_id" FOREIGN KEY ("upload_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "audit"."upload_logs" ADD CONSTRAINT "FK_upload_logs_status_type_id" FOREIGN KEY ("status_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plans" ADD CONSTRAINT "FK_study_plans_program_id" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_academic_periods" ADD CONSTRAINT "FK_study_plan_academic_periods_study_plan_id" FOREIGN KEY ("study_plan_id") REFERENCES "academic"."study_plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_academic_periods" ADD CONSTRAINT "FK_study_plan_academic_periods_academic_period_id" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_courses" ADD CONSTRAINT "FK_study_plan_courses_study_plan_academic_period_id" FOREIGN KEY ("study_plan_academic_period_id") REFERENCES "academic"."study_plan_academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_courses" ADD CONSTRAINT "FK_study_plan_courses_course_id" FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" ADD CONSTRAINT "FK_course_sections_course_id" FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" ADD CONSTRAINT "FK_course_sections_academic_period_id" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" ADD CONSTRAINT "FK_course_sections_campus_id" FOREIGN KEY ("campus_id") REFERENCES "organization"."campuses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" ADD CONSTRAINT "FK_course_sections_professor_id" FOREIGN KEY ("professor_id") REFERENCES "academic"."professors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" ADD CONSTRAINT "FK_students_user_id" FOREIGN KEY ("user_id") REFERENCES "organization"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" ADD CONSTRAINT "FK_students_program_id" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ADD CONSTRAINT "FK_surveys_student_id" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ADD CONSTRAINT "FK_surveys_academic_period_id" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ADD CONSTRAINT "FK_surveys_campus_id" FOREIGN KEY ("campus_id") REFERENCES "organization"."campuses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ADD CONSTRAINT "FK_surveys_program_id" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ADD CONSTRAINT "FK_surveys_course_section_id" FOREIGN KEY ("course_section_id") REFERENCES "academic"."course_sections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."scores" ADD CONSTRAINT "FK_scores_survey_id" FOREIGN KEY ("survey_id") REFERENCES "evidence"."surveys"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."scores" ADD CONSTRAINT "FK_scores_outcome_id" FOREIGN KEY ("outcome_id") REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."outcome_configs" ADD CONSTRAINT "FK_outcome_configs_outcome_id" FOREIGN KEY ("outcome_id") REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."notifications" ADD CONSTRAINT "FK_notifications_survey_id" FOREIGN KEY ("survey_id") REFERENCES "evidence"."surveys"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."notification_messages" ADD CONSTRAINT "FK_notification_messages_program_id" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."schools" ADD CONSTRAINT "FK_schools_faculty_id" FOREIGN KEY ("faculty_id") REFERENCES "organization"."faculties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."charts" ADD CONSTRAINT "FK_charts_staff_id" FOREIGN KEY ("staff_id") REFERENCES "organization"."staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."charts" ADD CONSTRAINT "FK_charts_academic_period_id" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."charts" ADD CONSTRAINT "FK_charts_level_type_id" FOREIGN KEY ("level_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."charts" ADD CONSTRAINT "FK_charts_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."plans" ADD CONSTRAINT "FK_plans_program_id" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."plans" ADD CONSTRAINT "FK_plans_academic_period_id" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."actions" ADD CONSTRAINT "FK_actions_program_id" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."actions" ADD CONSTRAINT "FK_actions_academic_period_id" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" ADD CONSTRAINT "FK_findings_criticality_type_id" FOREIGN KEY ("criticality_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" ADD CONSTRAINT "FK_findings_instrument_id" FOREIGN KEY ("instrument_id") REFERENCES "evidence"."instruments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" ADD CONSTRAINT "FK_findings_staff_id" FOREIGN KEY ("staff_id") REFERENCES "organization"."staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" ADD CONSTRAINT "FK_findings_course_id" FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" ADD CONSTRAINT "FK_findings_academic_period_id" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" ADD CONSTRAINT "FK_findings_campus_id" FOREIGN KEY ("campus_id") REFERENCES "organization"."campuses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."finding_actions" ADD CONSTRAINT "FK_finding_actions_finding_id" FOREIGN KEY ("finding_id") REFERENCES "improvement"."findings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."finding_actions" ADD CONSTRAINT "FK_finding_actions_action_id" FOREIGN KEY ("action_id") REFERENCES "improvement"."actions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."plan_actions" ADD CONSTRAINT "FK_plan_actions_plan_id" FOREIGN KEY ("plan_id") REFERENCES "improvement"."plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."plan_actions" ADD CONSTRAINT "FK_plan_actions_finding_action_id" FOREIGN KEY ("finding_action_id") REFERENCES "improvement"."finding_actions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."finding_outcomes" ADD CONSTRAINT "FK_finding_outcomes_finding_id" FOREIGN KEY ("finding_id") REFERENCES "improvement"."findings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."finding_outcomes" ADD CONSTRAINT "FK_finding_outcomes_outcome_id" FOREIGN KEY ("outcome_id") REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ifcs" ADD CONSTRAINT "FK_ifcs_course_id" FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ifcs" ADD CONSTRAINT "FK_ifcs_academic_period_id" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."statuses" ADD CONSTRAINT "FK_statuses_ifc_id" FOREIGN KEY ("ifc_id") REFERENCES "evidence"."ifcs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."statuses" ADD CONSTRAINT "FK_statuses_staff_id" FOREIGN KEY ("staff_id") REFERENCES "organization"."staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."ifc_findings" ADD CONSTRAINT "FK_ifc_findings_ifc_id" FOREIGN KEY ("ifc_id") REFERENCES "evidence"."ifcs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."ifc_findings" ADD CONSTRAINT "FK_ifc_findings_finding_id" FOREIGN KEY ("finding_id") REFERENCES "improvement"."findings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD CONSTRAINT "FK_notification_configs_school_id" FOREIGN KEY ("school_id") REFERENCES "organization"."schools"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD CONSTRAINT "FK_notification_configs_academic_period_id" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD CONSTRAINT "FK_notification_configs_trigger_type_id" FOREIGN KEY ("trigger_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD CONSTRAINT "FK_notification_configs_ifc_status_type_id" FOREIGN KEY ("ifc_status_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."users" ADD CONSTRAINT "FK_users_document_type_id" FOREIGN KEY ("document_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_logs" ADD CONSTRAINT "FK_notification_logs_ifc_id" FOREIGN KEY ("ifc_id") REFERENCES "evidence"."ifcs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_logs" ADD CONSTRAINT "FK_notification_logs_chart_id" FOREIGN KEY ("chart_id") REFERENCES "organization"."charts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_logs" ADD CONSTRAINT "FK_notification_logs_notification_config_id" FOREIGN KEY ("notification_config_id") REFERENCES "ifc"."notification_configs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_logs" ADD CONSTRAINT "FK_notification_logs_notifier_user_id" FOREIGN KEY ("notifier_user_id") REFERENCES "organization"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" ADD CONSTRAINT "FK_enrolled_students_student_id" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" ADD CONSTRAINT "FK_enrolled_students_campus_id" FOREIGN KEY ("campus_id") REFERENCES "organization"."campuses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_section_enrollments" ADD CONSTRAINT "FK_student_section_enrollments_enrolled_student_id" FOREIGN KEY ("enrolled_student_id") REFERENCES "academic"."enrolled_students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_section_enrollments" ADD CONSTRAINT "FK_student_section_enrollments_course_section_id" FOREIGN KEY ("course_section_id") REFERENCES "academic"."course_sections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."student_course_outcome_grades" ADD CONSTRAINT "FK_student_course_outcome_grades_student_section_enrollment_id" FOREIGN KEY ("student_section_enrollment_id") REFERENCES "academic"."student_section_enrollments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."student_course_outcome_grades" ADD CONSTRAINT "FK_student_course_outcome_grades_outcome_id" FOREIGN KEY ("outcome_id") REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" ADD CONSTRAINT "FK_project_evaluators_project_id" FOREIGN KEY ("project_id") REFERENCES "evaluation"."projects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" ADD CONSTRAINT "FK_project_evaluators_professor_id" FOREIGN KEY ("professor_id") REFERENCES "academic"."professors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_students" ADD CONSTRAINT "FK_project_students_project_id" FOREIGN KEY ("project_id") REFERENCES "evaluation"."projects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_students" ADD CONSTRAINT "FK_project_students_student_section_enrollment_id" FOREIGN KEY ("student_section_enrollment_id") REFERENCES "academic"."student_section_enrollments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" ADD CONSTRAINT "FK_evaluations_project_student_id" FOREIGN KEY ("project_student_id") REFERENCES "evaluation"."project_students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" ADD CONSTRAINT "FK_evaluations_project_evaluator_id" FOREIGN KEY ("project_evaluator_id") REFERENCES "evaluation"."project_evaluators"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubrics" ADD CONSTRAINT "FK_rubrics_rubric_type_id" FOREIGN KEY ("rubric_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubrics" ADD CONSTRAINT "FK_rubrics_grade_type_id" FOREIGN KEY ("grade_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubrics" ADD CONSTRAINT "FK_rubrics_study_plan_course_id" FOREIGN KEY ("study_plan_course_id") REFERENCES "academic"."study_plan_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_scores" ADD CONSTRAINT "FK_rubric_scores_evaluation_id" FOREIGN KEY ("evaluation_id") REFERENCES "evidence"."evaluations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_scores" ADD CONSTRAINT "FK_rubric_scores_rubric_question_criteria_id" FOREIGN KEY ("rubric_question_criteria_id") REFERENCES "evaluation"."rubric_question_criterias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_questions" ADD CONSTRAINT "FK_rubric_questions_rubric_id" FOREIGN KEY ("rubric_id") REFERENCES "evaluation"."rubrics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_questions" ADD CONSTRAINT "FK_rubric_questions_outcome_id" FOREIGN KEY ("outcome_id") REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."types" ADD CONSTRAINT "FK_types_type_group_id" FOREIGN KEY ("type_group_id") REFERENCES "core"."type_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_course_grades" ADD CONSTRAINT "FK_student_course_grades_student_section_enrollment_id" FOREIGN KEY ("student_section_enrollment_id") REFERENCES "academic"."student_section_enrollments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."performance_levels" ADD CONSTRAINT "FK_performance_levels_academic_period_id" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_outcome_mappings" ADD CONSTRAINT "FK_course_outcome_mappings_outcome_id" FOREIGN KEY ("outcome_id") REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_outcome_mappings" ADD CONSTRAINT "FK_course_outcome_mappings_study_plan_course_id" FOREIGN KEY ("study_plan_course_id") REFERENCES "academic"."study_plan_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."user_roles" ADD CONSTRAINT "FK_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "organization"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."user_roles" ADD CONSTRAINT "FK_user_roles_role" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."role_module_permissions" ADD CONSTRAINT "FK_rmp_role" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."role_module_permissions" ADD CONSTRAINT "FK_rmp_module_type" FOREIGN KEY ("module_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."role_module_permissions" ADD CONSTRAINT "FK_rmp_permission_type" FOREIGN KEY ("permission_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."academic_periods" ADD CONSTRAINT "FK_academic_periods_modality_type_id" FOREIGN KEY ("modality_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."programs" ADD CONSTRAINT "FK_programs_modality_type_id" FOREIGN KEY ("modality_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."program_commissions" ADD CONSTRAINT "FK_program_commissions_commission_type_id" FOREIGN KEY ("commission_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."staff" ADD CONSTRAINT "FK_staff_position_type_id" FOREIGN KEY ("position_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_courses" ADD CONSTRAINT "FK_study_plan_courses_level_type_id" FOREIGN KEY ("level_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plans" ADD CONSTRAINT "FK_study_plans_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."courses" ADD CONSTRAINT "FK_courses_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_courses" ADD CONSTRAINT "FK_study_plan_courses_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."staff" ADD CONSTRAINT "FK_staff_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."professors" ADD CONSTRAINT "FK_professors_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."outcomes" ADD CONSTRAINT "FK_outcomes_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_outcome_mappings" ADD CONSTRAINT "FK_course_outcome_mappings_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" ADD CONSTRAINT "FK_course_sections_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" ADD CONSTRAINT "FK_students_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" ADD CONSTRAINT "FK_enrolled_students_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_section_enrollments" ADD CONSTRAINT "FK_student_section_enrollments_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_course_grades" ADD CONSTRAINT "FK_student_course_grades_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."student_course_outcome_grades" ADD CONSTRAINT "FK_student_course_outcome_grades_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" ADD CONSTRAINT "FK_course_sections_section_modality_type_id" FOREIGN KEY ("section_modality_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" ADD CONSTRAINT "FK_students_graduation_modality_type_id" FOREIGN KEY ("graduation_modality_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ADD CONSTRAINT "FK_surveys_survey_type_id" FOREIGN KEY ("survey_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ADD CONSTRAINT "FK_surveys_survey_status_type_id" FOREIGN KEY ("survey_status_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."notifications" ADD CONSTRAINT "FK_notifications_notification_status_type_id" FOREIGN KEY ("notification_status_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."notification_messages" ADD CONSTRAINT "FK_notification_messages_survey_type_id" FOREIGN KEY ("survey_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."instruments" ADD CONSTRAINT "FK_instruments_constituent_type_id" FOREIGN KEY ("constituent_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."statuses" ADD CONSTRAINT "FK_statuses_status_type_id" FOREIGN KEY ("status_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" ADD CONSTRAINT "FK_enrolled_students_enrollement_modality_type_id" FOREIGN KEY ("enrollement_modality_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_question_criterias" ADD CONSTRAINT "FK_rubric_question_criterias_rubric_question_id" FOREIGN KEY ("rubric_question_id") REFERENCES "evaluation"."rubric_questions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" ADD CONSTRAINT "FK_project_evaluators_evaluator_type_id" FOREIGN KEY ("evaluator_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" ADD CONSTRAINT "FK_evaluations_qualification_status_type_id" FOREIGN KEY ("qualification_status_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_course_grades" ADD CONSTRAINT "FK_student_course_grades_grade_type_id" FOREIGN KEY ("grade_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."performance_levels" ADD CONSTRAINT "FK_performance_levels_instrument_type_id" FOREIGN KEY ("instrument_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_outcome_mappings" ADD CONSTRAINT "FK_course_outcome_mappings_outcome_type_id" FOREIGN KEY ("outcome_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_study_plans(
	p_rows jsonb,
	p_academic_period_id integer,
	p_user_id integer,
	p_source_file text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total integer := jsonb_array_length(p_rows);
	v_has_errors boolean := false;
	v_log_id integer;
	r record;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

	FOR r IN
		SELECT (e->>'rowNumber')::int AS row_number
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (trim(e->>'studyPlanCode'), lower(trim(e->>'courseCode'))) IN (
			SELECT trim(d->>'studyPlanCode'), lower(trim(d->>'courseCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'studyPlanCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'courseCode'), '') IS NOT NULL
			GROUP BY trim(d->>'studyPlanCode'), lower(trim(d->>'courseCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.row_number, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	FOR r IN
		SELECT
			(e->>'rowNumber')::int                AS row_number,
			NULLIF(trim(e->>'studyPlanCode'), '') AS study_plan_code,
			NULLIF(trim(e->>'programCode'), '')   AS program_code,
			NULLIF(trim(e->>'levelTypeCode'), '') AS level_type_code,
			NULLIF(trim(e->>'courseCode'), '')    AS course_code,
			COALESCE(e->'courseName', '{}'::jsonb) AS course_name
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.study_plan_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCodeEmpty'::text, NULL::integer;
		END IF;

		IF r.program_code IS NULL OR NOT EXISTS (SELECT 1 FROM academic.programs p WHERE p.code = r.program_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programNotFound'::text, NULL::integer;
		END IF;

		IF r.course_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
		END IF;

		IF NOT EXISTS (SELECT 1 FROM jsonb_each_text(r.course_name) AS kv(k, v) WHERE NULLIF(trim(kv.v), '') IS NOT NULL) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseNameEmpty'::text, NULL::integer;
		END IF;

		IF r.level_type_code IS NULL OR NOT EXISTS (
			SELECT 1 FROM core.types t
			JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG203' AND t.code = r.level_type_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'levelTypeInvalid'::text, NULL::integer;
		END IF;

		IF r.study_plan_code IS NOT NULL AND r.course_code IS NOT NULL AND EXISTS (
			SELECT 1
			FROM academic.study_plan_courses spc
			JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
			JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			JOIN academic.courses c ON c.id = spc.course_id
			WHERE spap.academic_period_id = p_academic_period_id
			  AND sp.code = r.study_plan_code
			  AND c.code = r.course_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseAlreadyInStudyPlan'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T002'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	WITH plan_src AS (
		SELECT DISTINCT ON (e->>'studyPlanCode')
			trim(e->>'studyPlanCode')                AS code,
			COALESCE(e->'studyPlanName','{}'::jsonb) AS name,
			(SELECT p.id FROM academic.programs p WHERE p.code = trim(e->>'programCode')) AS program_id
		FROM jsonb_array_elements(p_rows) AS e
	)
	INSERT INTO academic.study_plans (program_id, code, name, description, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT s.program_id, s.code, s.name, '{}'::jsonb, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM plan_src s
	ON CONFLICT (code) DO NOTHING;

	INSERT INTO academic.study_plan_academic_periods (study_plan_id, academic_period_id, extra, is_active, created_at, updated_at)
	SELECT DISTINCT sp.id, p_academic_period_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.study_plan_academic_periods x
		WHERE x.study_plan_id = sp.id AND x.academic_period_id = p_academic_period_id
	);

	WITH course_src AS (
		SELECT DISTINCT ON (lower(trim(e->>'courseCode')))
			trim(e->>'courseCode')                     AS code,
			COALESCE(e->'courseName','{}'::jsonb)      AS name,
			COALESCE(e->'learningOutcome','{}'::jsonb) AS learning_outcome
		FROM jsonb_array_elements(p_rows) AS e
	)
	INSERT INTO academic.courses (code, name, description, learning_outcome, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT c.code, c.name, '{}'::jsonb, c.learning_outcome, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM course_src c
	ON CONFLICT (code) DO NOTHING;

	INSERT INTO academic.study_plan_courses
		(study_plan_academic_period_id, course_id, is_elective, level_type_id, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT
		spap.id,
		c.id,
		COALESCE((e->>'isElective')::boolean, false),
		t.id,
		v_log_id,
		'{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	JOIN academic.study_plan_academic_periods spap
		ON spap.study_plan_id = sp.id AND spap.academic_period_id = p_academic_period_id
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN core.type_groups g ON g.code = 'TG203'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'levelTypeCode');

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_study_plans(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	IF EXISTS (
		SELECT 1 FROM academic.study_plan_courses spc
		JOIN academic.course_outcome_mappings com ON com.study_plan_course_id = spc.id
		WHERE spc.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedOutcomes';
	END IF;

	-- block out-of-order rollback: a NEWER study-plans upload reused rows this upload created.
	-- courses / study_plans are shared (ON CONFLICT DO NOTHING), so a later upload can hang its
	-- study_plan_courses off them; deleting them here would orphan that upload. Roll back newer first.
	IF EXISTS (
		SELECT 1 FROM academic.study_plan_courses spc
		WHERE spc.upload_log_id IS DISTINCT FROM p_upload_log_id
		  AND spc.course_id IN (SELECT id FROM academic.courses WHERE upload_log_id = p_upload_log_id)
	) OR EXISTS (
		SELECT 1 FROM academic.study_plan_courses spc
		JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
		WHERE spc.upload_log_id IS DISTINCT FROM p_upload_log_id
		  AND spap.study_plan_id IN (SELECT id FROM academic.study_plans WHERE upload_log_id = p_upload_log_id)
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	DELETE FROM academic.study_plan_courses WHERE upload_log_id = p_upload_log_id;
	DELETE FROM academic.courses WHERE upload_log_id = p_upload_log_id;
	DELETE FROM academic.study_plan_academic_periods spap
	WHERE spap.study_plan_id IN (SELECT id FROM academic.study_plans WHERE upload_log_id = p_upload_log_id)
	  AND NOT EXISTS (SELECT 1 FROM academic.study_plan_courses spc WHERE spc.study_plan_academic_period_id = spap.id);
	DELETE FROM academic.study_plans WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_staff(
	p_rows jsonb,
	p_academic_period_id integer,
	p_user_id integer,
	p_source_file text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total integer := jsonb_array_length(p_rows);
	v_has_errors boolean := false;
	v_log_id integer;
	r record;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

	-- intra-file duplicate email
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE lower(trim(e->>'email')) IN (
			SELECT lower(trim(d->>'email'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'email'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'email'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateEmailInFile'::text, NULL::integer;
	END LOOP;

	-- intra-file duplicate professor code
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE NULLIF(trim(e->>'professorCode'), '') IS NOT NULL
		  AND lower(trim(e->>'professorCode')) IN (
			SELECT lower(trim(d->>'professorCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'professorCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'professorCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateProfessorCodeInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                  AS row_number,
			NULLIF(trim(e->>'email'), '')           AS email,
			NULLIF(trim(e->>'positionTypeCode'), '') AS position_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.email IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'emailEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM organization.users u WHERE lower(u.email) = lower(r.email)) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'userNotFound'::text, NULL::integer;
		END IF;

		IF r.position_code IS NULL OR NOT EXISTS (
			SELECT 1 FROM core.types t
			JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG901' AND t.code = r.position_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'positionTypeInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T001'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert staff for users that do not have one yet
	INSERT INTO organization.staff
		(user_id, position_type_id, job_title, job_description, staff_email, staff_phone, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		u.id,
		pt.id,
		COALESCE(e->'jobTitle', '{}'::jsonb),
		'{}'::jsonb,
		u.email,
		u.phone,
		v_log_id,
		'{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN organization.users u
		ON u.id = (SELECT uu.id FROM organization.users uu WHERE lower(uu.email) = lower(trim(e->>'email')) ORDER BY uu.id LIMIT 1)
	JOIN core.type_groups g ON g.code = 'TG901'
	JOIN core.types pt ON pt.type_group_id = g.id AND pt.code = trim(e->>'positionTypeCode')
	WHERE NOT EXISTS (SELECT 1 FROM organization.staff s WHERE s.user_id = u.id);

	-- update staff that already existed (push prior values onto the extra.uploadUndo stack for rollback)
	UPDATE organization.staff s
	SET position_type_id = pt.id,
		job_title = COALESCE(e->'jobTitle', '{}'::jsonb),
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(s.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(s.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'positionTypeId', s.position_type_id, 'jobTitle', s.job_title))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN organization.users u
		ON u.id = (SELECT uu.id FROM organization.users uu WHERE lower(uu.email) = lower(trim(e->>'email')) ORDER BY uu.id LIMIT 1)
	JOIN core.type_groups g ON g.code = 'TG901'
	JOIN core.types pt ON pt.type_group_id = g.id AND pt.code = trim(e->>'positionTypeCode')
	WHERE s.user_id = u.id
	  AND s.upload_log_id IS DISTINCT FROM v_log_id;

	-- insert professors for new codes
	INSERT INTO academic.professors (staff_id, code, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT s.id, trim(e->>'professorCode'), v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN organization.users u
		ON u.id = (SELECT uu.id FROM organization.users uu WHERE lower(uu.email) = lower(trim(e->>'email')) ORDER BY uu.id LIMIT 1)
	JOIN organization.staff s ON s.user_id = u.id
	WHERE NULLIF(trim(e->>'professorCode'), '') IS NOT NULL
	  AND NOT EXISTS (SELECT 1 FROM academic.professors p WHERE p.code = trim(e->>'professorCode'));

	-- re-point professors whose code already existed (push prior staff_id onto the extra.uploadUndo stack)
	UPDATE academic.professors p
	SET staff_id = s.id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(p.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(p.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'staffId', p.staff_id))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN organization.users u
		ON u.id = (SELECT uu.id FROM organization.users uu WHERE lower(uu.email) = lower(trim(e->>'email')) ORDER BY uu.id LIMIT 1)
	JOIN organization.staff s ON s.user_id = u.id
	WHERE NULLIF(trim(e->>'professorCode'), '') IS NOT NULL
	  AND p.code = trim(e->>'professorCode')
	  AND p.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_staff(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if a professor created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM academic.course_sections cs
		JOIN academic.professors p ON p.id = cs.professor_id
		WHERE p.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evaluation.project_evaluators pe
		JOIN academic.professors p ON p.id = pe.professor_id
		WHERE p.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedProfessors';
	END IF;

	-- block if a staff created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM organization.charts c
		JOIN organization.staff s ON s.id = c.staff_id
		WHERE s.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM improvement.findings f
		JOIN organization.staff s ON s.id = f.staff_id
		WHERE s.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM ifc.statuses st
		JOIN organization.staff s ON s.id = st.staff_id
		WHERE s.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedStaff';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	-- Blocked when this upload's id is in a row's uploadUndo stack but is NOT the top element (a later
	-- upload updated it since), or when this upload INSERTED a row that a later upload has since updated
	-- (the inserted row carries a non-empty stack). Roll back the newer upload first.
	IF EXISTS (
		SELECT 1 FROM organization.staff s
		WHERE (s.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (s.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM organization.staff s
		WHERE s.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(s.extra->'uploadUndo', '[]'::jsonb)) > 0
	) OR EXISTS (
		SELECT 1 FROM academic.professors p
		WHERE (p.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (p.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.professors p
		WHERE p.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(p.extra->'uploadUndo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore re-pointed professors by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE academic.professors p
	SET staff_id = (p.extra->'uploadUndo' -> -1 ->> 'staffId')::int,
		extra = CASE
			WHEN jsonb_array_length(p.extra->'uploadUndo') <= 1 THEN p.extra - 'uploadUndo'
			ELSE jsonb_set(p.extra, '{uploadUndo}', (p.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (p.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM academic.professors WHERE upload_log_id = p_upload_log_id;

	-- restore updated staff by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE organization.staff s
	SET position_type_id = (s.extra->'uploadUndo' -> -1 ->> 'positionTypeId')::int,
		job_title = s.extra->'uploadUndo' -> -1 -> 'jobTitle',
		extra = CASE
			WHEN jsonb_array_length(s.extra->'uploadUndo') <= 1 THEN s.extra - 'uploadUndo'
			ELSE jsonb_set(s.extra, '{uploadUndo}', (s.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (s.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM organization.staff WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_charts(
	p_rows jsonb,
	p_academic_period_id integer,
	p_user_id integer,
	p_source_file text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total integer := jsonb_array_length(p_rows);
	v_has_errors boolean := false;
	v_log_id integer;
	r record;
BEGIN
	-- The academic period and the "period already has an uploaded chart" guard are checked in the
	-- service (request-level HTTP errors), not here.

	-- intra-file duplicate node code
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE lower(trim(e->>'code')) IN (
			SELECT lower(trim(d->>'code'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'code'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'code'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateCodeInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                 AS row_number,
			NULLIF(trim(e->>'code'), '')           AS code,
			NULLIF(trim(e->>'parentCode'), '')     AS parent_code,
			NULLIF(trim(e->>'levelTypeCode'), '')  AS level_type_code,
			COALESCE(e->'title', '{}'::jsonb)      AS title,
			NULLIF(trim(e->>'email'), '')          AS email,
			NULLIF(trim(e->>'entityTypeCode'), '') AS entity_type_code,
			NULLIF(trim(e->>'entityCode'), '')     AS entity_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'codeEmpty'::text, NULL::integer;
		END IF;

		IF r.level_type_code IS NULL OR NOT EXISTS (
			SELECT 1 FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG902' AND t.code = r.level_type_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'levelTypeInvalid'::text, NULL::integer;
		END IF;

		IF NOT EXISTS (SELECT 1 FROM jsonb_each_text(r.title) AS kv(k, v) WHERE NULLIF(trim(kv.v), '') IS NOT NULL) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'titleEmpty'::text, NULL::integer;
		END IF;

		IF r.email IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'emailEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM organization.users u WHERE lower(u.email) = lower(r.email)) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'userNotFound'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1 FROM organization.users u JOIN organization.staff s ON s.user_id = u.id
			WHERE lower(u.email) = lower(r.email)
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'staffNotFound'::text, NULL::integer;
		END IF;

		IF (r.entity_type_code IS NULL) <> (r.entity_code IS NULL) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'entityIncomplete'::text, NULL::integer;
		ELSIF r.entity_type_code IS NOT NULL THEN
			IF NOT EXISTS (
				SELECT 1 FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
				WHERE g.code = 'TG903' AND t.code = r.entity_type_code
			) THEN
				v_has_errors := true;
				RETURN QUERY SELECT r.row_number, 'entityTypeInvalid'::text, NULL::integer;
			ELSIF NOT (
				(r.entity_type_code = 'TG903-T001' AND EXISTS (SELECT 1 FROM organization.schools x WHERE x.code = r.entity_code)) OR
				(r.entity_type_code = 'TG903-T002' AND EXISTS (SELECT 1 FROM academic.programs x WHERE x.code = r.entity_code)) OR
				(r.entity_type_code = 'TG903-T003' AND EXISTS (SELECT 1 FROM academic.courses x WHERE x.code = r.entity_code))
			) THEN
				v_has_errors := true;
				RETURN QUERY SELECT r.row_number, 'entityNotFound'::text, NULL::integer;
			END IF;
		END IF;

		IF r.parent_code IS NOT NULL AND NOT EXISTS (
			SELECT 1 FROM jsonb_array_elements(p_rows) AS d
			WHERE lower(trim(d->>'code')) = lower(r.parent_code)
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'parentNotFound'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T004'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- pass 1: insert every node (root_chart_id NULL), keep the file code in extra for wiring
	INSERT INTO organization.charts
		(staff_id, academic_period_id, level_type_id, root_chart_id, title, entity_type_id, entity_code,
		 upload_log_id, extra, is_active, created_at, updated_at)
	SELECT
		s.id,
		p_academic_period_id,
		lt.id,
		NULL,
		COALESCE(e->'title', '{}'::jsonb),
		et.id,
		CASE
			WHEN et.code = 'TG903-T001' THEN (SELECT id FROM organization.schools WHERE code = trim(e->>'entityCode'))
			WHEN et.code = 'TG903-T002' THEN (SELECT id FROM academic.programs WHERE code = trim(e->>'entityCode'))
			WHEN et.code = 'TG903-T003' THEN (SELECT id FROM academic.courses WHERE code = trim(e->>'entityCode'))
			ELSE NULL
		END,
		v_log_id,
		jsonb_build_object('uploadNodeCode', lower(trim(e->>'code'))),
		true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN organization.staff s
		ON s.id = (SELECT ss.id FROM organization.staff ss
		           JOIN organization.users uu ON uu.id = ss.user_id
		           WHERE lower(uu.email) = lower(trim(e->>'email')) ORDER BY ss.id LIMIT 1)
	JOIN core.type_groups gl ON gl.code = 'TG902'
	JOIN core.types lt ON lt.type_group_id = gl.id AND lt.code = trim(e->>'levelTypeCode')
	LEFT JOIN core.type_groups ge ON ge.code = 'TG903'
	LEFT JOIN core.types et ON et.type_group_id = ge.id AND et.code = NULLIF(trim(e->>'entityTypeCode'), '');

	-- pass 2: wire root_chart_id by matching parentCode -> the node whose code matches (this upload)
	UPDATE organization.charts child
	SET root_chart_id = parent.id, updated_at = NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN organization.charts parent
		ON parent.upload_log_id = v_log_id
	   AND parent.extra->>'uploadNodeCode' = lower(trim(e->>'parentCode'))
	WHERE child.upload_log_id = v_log_id
	  AND child.extra->>'uploadNodeCode' = lower(trim(e->>'code'))
	  AND NULLIF(trim(e->>'parentCode'), '') IS NOT NULL;

	-- drop the temporary wiring code from extra
	UPDATE organization.charts SET extra = extra - 'uploadNodeCode' WHERE charts.upload_log_id = v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_charts(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- charts self-reference via root_chart_id; clear the links before deleting the rows.
	UPDATE organization.charts SET root_chart_id = NULL WHERE upload_log_id = p_upload_log_id;
	DELETE FROM organization.charts WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_outcomes(
	p_rows jsonb,
	p_academic_period_id integer,
	p_user_id integer,
	p_source_file text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total integer := jsonb_array_length(p_rows);
	v_has_errors boolean := false;
	v_log_id integer;
	r record;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

	-- intra-file duplicate outcome code
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE lower(trim(e->>'outcomeCode')) IN (
			SELECT lower(trim(d->>'outcomeCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'outcomeCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'outcomeCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateCodeInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                 AS row_number,
			NULLIF(trim(e->>'outcomeCode'), '')    AS outcome_code,
			NULLIF(trim(e->>'programCode'), '')    AS program_code,
			NULLIF(trim(e->>'commissionCode'), '') AS commission_code,
			COALESCE(e->'outcomeName', '{}'::jsonb) AS outcome_name
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.outcome_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeCodeEmpty'::text, NULL::integer;
		END IF;

		IF NOT EXISTS (SELECT 1 FROM jsonb_each_text(r.outcome_name) AS kv(k, v) WHERE NULLIF(trim(kv.v), '') IS NOT NULL) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeNameEmpty'::text, NULL::integer;
		END IF;

		IF r.program_code IS NULL OR NOT EXISTS (SELECT 1 FROM academic.programs p WHERE p.code = r.program_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programNotFound'::text, NULL::integer;
		END IF;

		IF r.commission_code IS NULL OR NOT EXISTS (SELECT 1 FROM accreditation.commissions c WHERE c.code = r.commission_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'commissionNotFound'::text, NULL::integer;
		END IF;

		-- the program_commission (program + commission + period) must already exist (catalog)
		IF r.program_code IS NOT NULL AND r.commission_code IS NOT NULL AND NOT EXISTS (
			SELECT 1
			FROM accreditation.program_commissions pc
			JOIN academic.programs p ON p.id = pc.program_id
			JOIN accreditation.commissions c ON c.id = pc.commission_id
			WHERE p.code = r.program_code
			  AND c.code = r.commission_code
			  AND pc.academic_period_id = p_academic_period_id
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programCommissionNotFound'::text, NULL::integer;
		END IF;

		-- outcome_code is globally unique: an existing one under a different program_commission is a conflict
		IF r.outcome_code IS NOT NULL AND EXISTS (
			SELECT 1
			FROM accreditation.outcomes o
			JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			JOIN academic.programs p ON p.id = pc.program_id
			JOIN accreditation.commissions c ON c.id = pc.commission_id
			WHERE o.outcome_code = r.outcome_code
			  AND NOT (p.code = r.program_code AND c.code = r.commission_code AND pc.academic_period_id = p_academic_period_id)
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeCodeConflict'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T003'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert outcomes whose code does not exist yet
	INSERT INTO accreditation.outcomes
		(program_commission_id, outcome_code, outcome_name, outcome_description, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		pc.id,
		trim(e->>'outcomeCode'),
		COALESCE(e->'outcomeName', '{}'::jsonb),
		'{}'::jsonb,
		v_log_id,
		'{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.programs p ON p.code = trim(e->>'programCode')
	JOIN accreditation.commissions c ON c.code = trim(e->>'commissionCode')
	JOIN accreditation.program_commissions pc
		ON pc.program_id = p.id AND pc.commission_id = c.id AND pc.academic_period_id = p_academic_period_id
	WHERE NOT EXISTS (SELECT 1 FROM accreditation.outcomes o WHERE o.outcome_code = trim(e->>'outcomeCode'));

	-- update outcomes whose code already existed (push prior name onto the extra.uploadUndo stack)
	UPDATE accreditation.outcomes o
	SET outcome_name = COALESCE(e->'outcomeName', '{}'::jsonb),
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(o.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(o.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'outcomeName', o.outcome_name))
	FROM jsonb_array_elements(p_rows) AS e
	WHERE o.outcome_code = trim(e->>'outcomeCode')
	  AND o.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_outcomes(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if an outcome created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM improvement.finding_outcomes fo
		JOIN accreditation.outcomes o ON o.id = fo.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM survey.scores sc
		JOIN accreditation.outcomes o ON o.id = sc.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM survey.outcome_configs oc
		JOIN accreditation.outcomes o ON o.id = oc.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evidence.student_course_outcome_grades g
		JOIN accreditation.outcomes o ON o.id = g.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evaluation.rubric_questions rq
		JOIN accreditation.outcomes o ON o.id = rq.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.course_outcome_mappings com
		JOIN accreditation.outcomes o ON o.id = com.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedOutcomeRefs';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM accreditation.outcomes o
		WHERE (o.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (o.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM accreditation.outcomes o
		WHERE o.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(o.extra->'uploadUndo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated outcomes by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE accreditation.outcomes o
	SET outcome_name = o.extra->'uploadUndo' -> -1 -> 'outcomeName',
		extra = CASE
			WHEN jsonb_array_length(o.extra->'uploadUndo') <= 1 THEN o.extra - 'uploadUndo'
			ELSE jsonb_set(o.extra, '{uploadUndo}', (o.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (o.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM accreditation.outcomes WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_articulation(
	p_rows jsonb,
	p_academic_period_id integer,
	p_user_id integer,
	p_source_file text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total integer := jsonb_array_length(p_rows);
	v_has_errors boolean := false;
	v_log_id integer;
	r record;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

	-- intra-file duplicate (outcome, study plan, course)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'outcomeCode')), lower(trim(e->>'studyPlanCode')), lower(trim(e->>'courseCode'))) IN (
			SELECT lower(trim(d->>'outcomeCode')), lower(trim(d->>'studyPlanCode')), lower(trim(d->>'courseCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'outcomeCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'studyPlanCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'courseCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'outcomeCode')), lower(trim(d->>'studyPlanCode')), lower(trim(d->>'courseCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                  AS row_number,
			NULLIF(trim(e->>'outcomeCode'), '')     AS outcome_code,
			NULLIF(trim(e->>'studyPlanCode'), '')   AS study_plan_code,
			NULLIF(trim(e->>'courseCode'), '')      AS course_code,
			NULLIF(trim(e->>'outcomeTypeCode'), '') AS outcome_type_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.outcome_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM accreditation.outcomes o WHERE o.outcome_code = r.outcome_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeNotFound'::text, NULL::integer;
		END IF;

		IF r.study_plan_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCodeEmpty'::text, NULL::integer;
		END IF;

		IF r.course_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
		END IF;

		-- the study_plan_course (plan + course + period) must exist
		IF r.study_plan_code IS NOT NULL AND r.course_code IS NOT NULL AND NOT EXISTS (
			SELECT 1
			FROM academic.study_plan_courses spc
			JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
			JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			JOIN academic.courses c ON c.id = spc.course_id
			WHERE spap.academic_period_id = p_academic_period_id
			  AND sp.code = r.study_plan_code
			  AND c.code = r.course_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCourseNotFound'::text, NULL::integer;
		END IF;

		IF r.outcome_type_code IS NULL OR NOT EXISTS (
			SELECT 1 FROM core.types t
			JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG302' AND t.code = r.outcome_type_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeTypeInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T009'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert mappings that do not exist yet (uniqueness = outcome + study_plan_course)
	INSERT INTO academic.course_outcome_mappings
		(outcome_id, study_plan_course_id, outcome_type_id, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT
		o.id, spc.id, t.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN accreditation.outcomes o ON o.outcome_code = trim(e->>'outcomeCode')
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	JOIN academic.study_plan_academic_periods spap
		ON spap.study_plan_id = sp.id AND spap.academic_period_id = p_academic_period_id
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN academic.study_plan_courses spc
		ON spc.study_plan_academic_period_id = spap.id AND spc.course_id = c.id
	JOIN core.type_groups g ON g.code = 'TG302'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'outcomeTypeCode')
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.course_outcome_mappings com
		WHERE com.outcome_id = o.id AND com.study_plan_course_id = spc.id
	);

	-- update mappings that already existed (push prior outcome type onto the extra.uploadUndo stack)
	UPDATE academic.course_outcome_mappings com
	SET outcome_type_id = t.id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(com.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(com.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'outcomeTypeId', com.outcome_type_id))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN accreditation.outcomes o ON o.outcome_code = trim(e->>'outcomeCode')
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	JOIN academic.study_plan_academic_periods spap
		ON spap.study_plan_id = sp.id AND spap.academic_period_id = p_academic_period_id
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN academic.study_plan_courses spc
		ON spc.study_plan_academic_period_id = spap.id AND spc.course_id = c.id
	JOIN core.type_groups g ON g.code = 'TG302'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'outcomeTypeCode')
	WHERE com.outcome_id = o.id
	  AND com.study_plan_course_id = spc.id
	  AND com.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_articulation(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM academic.course_outcome_mappings com
		WHERE (com.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (com.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.course_outcome_mappings com
		WHERE com.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(com.extra->'uploadUndo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated mappings by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE academic.course_outcome_mappings com
	SET outcome_type_id = (com.extra->'uploadUndo' -> -1 ->> 'outcomeTypeId')::int,
		extra = CASE
			WHEN jsonb_array_length(com.extra->'uploadUndo') <= 1 THEN com.extra - 'uploadUndo'
			ELSE jsonb_set(com.extra, '{uploadUndo}', (com.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (com.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM academic.course_outcome_mappings WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_sections(
	p_rows jsonb,
	p_academic_period_id integer,
	p_user_id integer,
	p_source_file text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total integer := jsonb_array_length(p_rows);
	v_has_errors boolean := false;
	v_log_id integer;
	r record;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

	-- intra-file duplicate section code
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE lower(trim(e->>'sectionCode')) IN (
			SELECT lower(trim(d->>'sectionCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'sectionCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'sectionCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateCodeInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                      AS row_number,
			NULLIF(trim(e->>'sectionCode'), '')         AS section_code,
			NULLIF(trim(e->>'studyPlanCode'), '')       AS study_plan_code,
			NULLIF(trim(e->>'courseCode'), '')          AS course_code,
			NULLIF(trim(e->>'campusCode'), '')          AS campus_code,
			NULLIF(trim(e->>'professorCode'), '')       AS professor_code,
			NULLIF(trim(e->>'sectionModalityTypeCode'), '') AS modality_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.section_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionCodeEmpty'::text, NULL::integer;
		END IF;

		IF r.study_plan_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCodeEmpty'::text, NULL::integer;
		END IF;

		IF r.course_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
		END IF;

		-- the study_plan_course (plan + course + period) must exist
		IF r.study_plan_code IS NOT NULL AND r.course_code IS NOT NULL AND NOT EXISTS (
			SELECT 1
			FROM academic.study_plan_courses spc
			JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
			JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			JOIN academic.courses c ON c.id = spc.course_id
			WHERE spap.academic_period_id = p_academic_period_id
			  AND sp.code = r.study_plan_code
			  AND c.code = r.course_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCourseNotFound'::text, NULL::integer;
		END IF;

		IF r.campus_code IS NULL OR NOT EXISTS (SELECT 1 FROM organization.campuses cam WHERE cam.code = r.campus_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'campusNotFound'::text, NULL::integer;
		END IF;

		IF r.professor_code IS NULL OR NOT EXISTS (SELECT 1 FROM academic.professors pr WHERE pr.code = r.professor_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'professorNotFound'::text, NULL::integer;
		END IF;

		IF r.modality_code IS NULL OR NOT EXISTS (
			SELECT 1 FROM core.types t
			JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG103' AND t.code = r.modality_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionModalityInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T005'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert sections whose code does not exist yet (schedule left NULL per spec)
	INSERT INTO academic.course_sections
		(course_id, academic_period_id, campus_id, professor_id, section_code, schedule, section_modality_type_id, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		c.id, spap.academic_period_id, cam.id, pr.id, trim(e->>'sectionCode'), NULL, t.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	JOIN academic.study_plan_academic_periods spap
		ON spap.study_plan_id = sp.id AND spap.academic_period_id = p_academic_period_id
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN academic.study_plan_courses spc
		ON spc.study_plan_academic_period_id = spap.id AND spc.course_id = c.id
	JOIN organization.campuses cam ON cam.code = trim(e->>'campusCode')
	JOIN academic.professors pr ON pr.code = trim(e->>'professorCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'sectionModalityTypeCode')
	WHERE NOT EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = trim(e->>'sectionCode'));

	-- update sections whose code already existed (push prior values onto the extra.uploadUndo stack)
	UPDATE academic.course_sections cs
	SET course_id = c.id,
		academic_period_id = spap.academic_period_id,
		campus_id = cam.id,
		professor_id = pr.id,
		section_modality_type_id = t.id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(cs.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(cs.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'courseId', cs.course_id,
				'academicPeriodId', cs.academic_period_id,
				'campusId', cs.campus_id, 'professorId', cs.professor_id,
				'sectionModalityTypeId', cs.section_modality_type_id))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	JOIN academic.study_plan_academic_periods spap
		ON spap.study_plan_id = sp.id AND spap.academic_period_id = p_academic_period_id
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN academic.study_plan_courses spc
		ON spc.study_plan_academic_period_id = spap.id AND spc.course_id = c.id
	JOIN organization.campuses cam ON cam.code = trim(e->>'campusCode')
	JOIN academic.professors pr ON pr.code = trim(e->>'professorCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'sectionModalityTypeCode')
	WHERE cs.section_code = trim(e->>'sectionCode')
	  AND cs.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_sections(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if a section created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM academic.student_section_enrollments sse
		JOIN academic.course_sections cs ON cs.id = sse.course_section_id
		WHERE cs.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evidence.surveys sv
		JOIN academic.course_sections cs ON cs.id = sv.course_section_id
		WHERE cs.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedSectionRefs';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM academic.course_sections cs
		WHERE (cs.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (cs.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.course_sections cs
		WHERE cs.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(cs.extra->'uploadUndo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated sections by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE academic.course_sections cs
	SET course_id = (cs.extra->'uploadUndo' -> -1 ->> 'courseId')::int,
		academic_period_id = (cs.extra->'uploadUndo' -> -1 ->> 'academicPeriodId')::int,
		campus_id = (cs.extra->'uploadUndo' -> -1 ->> 'campusId')::int,
		professor_id = (cs.extra->'uploadUndo' -> -1 ->> 'professorId')::int,
		section_modality_type_id = (cs.extra->'uploadUndo' -> -1 ->> 'sectionModalityTypeId')::int,
		extra = CASE
			WHEN jsonb_array_length(cs.extra->'uploadUndo') <= 1 THEN cs.extra - 'uploadUndo'
			ELSE jsonb_set(cs.extra, '{uploadUndo}', (cs.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (cs.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM academic.course_sections WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_enrolled_students(
	p_rows jsonb,
	p_academic_period_id integer,
	p_user_id integer,
	p_source_file text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total integer := jsonb_array_length(p_rows);
	v_has_errors boolean := false;
	v_log_id integer;
	r record;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

	-- intra-file duplicate student code
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE lower(trim(e->>'studentCode')) IN (
			SELECT lower(trim(d->>'studentCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'studentCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'studentCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateCodeInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                      AS row_number,
			NULLIF(trim(e->>'studentCode'), '')         AS student_code,
			NULLIF(trim(e->>'email'), '')               AS email,
			NULLIF(trim(e->>'programCode'), '')         AS program_code,
			NULLIF(trim(e->>'studyPlanCode'), '')       AS study_plan_code,
			NULLIF(trim(e->>'campusCode'), '')          AS campus_code,
			NULLIF(trim(e->>'enrollmentModalityTypeCode'), '') AS modality_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.student_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentCodeEmpty'::text, NULL::integer;
		END IF;

		IF r.email IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'emailEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM organization.users u WHERE lower(u.email) = lower(r.email)) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'userNotFound'::text, NULL::integer;
		END IF;

		IF r.program_code IS NULL OR NOT EXISTS (SELECT 1 FROM academic.programs p WHERE p.code = r.program_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programNotFound'::text, NULL::integer;
		END IF;

		IF r.study_plan_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1
			FROM academic.study_plan_academic_periods spap
			JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			WHERE sp.code = r.study_plan_code AND spap.academic_period_id = p_academic_period_id
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanPeriodNotFound'::text, NULL::integer;
		END IF;

		IF r.campus_code IS NULL OR NOT EXISTS (SELECT 1 FROM organization.campuses cam WHERE cam.code = r.campus_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'campusNotFound'::text, NULL::integer;
		END IF;

		IF r.modality_code IS NULL OR NOT EXISTS (
			SELECT 1 FROM core.types t
			JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG103' AND t.code = r.modality_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'enrollmentModalityInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T006'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert students whose code does not exist yet (graduation modality = the enrollment modality per spec)
	INSERT INTO academic.students
		(code, user_id, program_id, graduation_modality_type_id, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT
		trim(e->>'studentCode'), u.id, p.id, tm.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN organization.users u
		ON u.id = (SELECT uu.id FROM organization.users uu WHERE lower(uu.email) = lower(trim(e->>'email')) ORDER BY uu.id LIMIT 1)
	JOIN academic.programs p ON p.code = trim(e->>'programCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types tm ON tm.type_group_id = g.id AND tm.code = trim(e->>'enrollmentModalityTypeCode')
	WHERE NOT EXISTS (SELECT 1 FROM academic.students s WHERE s.code = trim(e->>'studentCode'));

	-- update students whose code already existed (push prior values onto the extra.uploadUndo stack)
	UPDATE academic.students s
	SET user_id = u.id,
		program_id = p.id,
		graduation_modality_type_id = tm.id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(s.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(s.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'userId', s.user_id, 'programId', s.program_id,
				'graduationModalityTypeId', s.graduation_modality_type_id))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN organization.users u
		ON u.id = (SELECT uu.id FROM organization.users uu WHERE lower(uu.email) = lower(trim(e->>'email')) ORDER BY uu.id LIMIT 1)
	JOIN academic.programs p ON p.code = trim(e->>'programCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types tm ON tm.type_group_id = g.id AND tm.code = trim(e->>'enrollmentModalityTypeCode')
	WHERE s.code = trim(e->>'studentCode')
	  AND s.upload_log_id IS DISTINCT FROM v_log_id;

	-- insert enrollments that do not exist yet (uniqueness = student + study_plan_academic_period)
	INSERT INTO academic.enrolled_students
		(student_id, study_plan_academic_period, campus_id, enrollement_modality_type_id, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		s.id, spap.id, cam.id, tm.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.students s ON s.code = trim(e->>'studentCode')
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	JOIN academic.study_plan_academic_periods spap
		ON spap.study_plan_id = sp.id AND spap.academic_period_id = p_academic_period_id
	JOIN organization.campuses cam ON cam.code = trim(e->>'campusCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types tm ON tm.type_group_id = g.id AND tm.code = trim(e->>'enrollmentModalityTypeCode')
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE es.student_id = s.id AND es.study_plan_academic_period = spap.id
	);

	-- update enrollments that already existed (push prior values onto the extra.uploadUndo stack)
	UPDATE academic.enrolled_students es
	SET campus_id = cam.id,
		enrollement_modality_type_id = tm.id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(es.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(es.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'campusId', es.campus_id,
				'enrollementModalityTypeId', es.enrollement_modality_type_id))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.students s ON s.code = trim(e->>'studentCode')
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	JOIN academic.study_plan_academic_periods spap
		ON spap.study_plan_id = sp.id AND spap.academic_period_id = p_academic_period_id
	JOIN organization.campuses cam ON cam.code = trim(e->>'campusCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types tm ON tm.type_group_id = g.id AND tm.code = trim(e->>'enrollmentModalityTypeCode')
	WHERE es.student_id = s.id
	  AND es.study_plan_academic_period = spap.id
	  AND es.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_enrolled_students(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if an enrollment / student created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM academic.student_section_enrollments sse
		JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
		WHERE es.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evidence.surveys sv
		JOIN academic.students s ON s.id = sv.student_id
		WHERE s.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedEnrollmentRefs';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed,
	-- and no newer upload may have hung an enrollment off a student this one inserted.
	IF EXISTS (
		SELECT 1 FROM academic.students s
		WHERE (s.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (s.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.students s
		WHERE s.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(s.extra->'uploadUndo', '[]'::jsonb)) > 0
	) OR EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE (es.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (es.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE es.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(es.extra->'uploadUndo', '[]'::jsonb)) > 0
	) OR EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE es.upload_log_id IS DISTINCT FROM p_upload_log_id
		  AND es.student_id IN (SELECT id FROM academic.students WHERE upload_log_id = p_upload_log_id)
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated enrollments (pop), then drop inserted enrollments
	UPDATE academic.enrolled_students es
	SET campus_id = (es.extra->'uploadUndo' -> -1 ->> 'campusId')::int,
		enrollement_modality_type_id = (es.extra->'uploadUndo' -> -1 ->> 'enrollementModalityTypeId')::int,
		extra = CASE
			WHEN jsonb_array_length(es.extra->'uploadUndo') <= 1 THEN es.extra - 'uploadUndo'
			ELSE jsonb_set(es.extra, '{uploadUndo}', (es.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (es.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM academic.enrolled_students WHERE upload_log_id = p_upload_log_id;

	-- restore updated students (pop), then drop inserted students
	UPDATE academic.students s
	SET user_id = (s.extra->'uploadUndo' -> -1 ->> 'userId')::int,
		program_id = (s.extra->'uploadUndo' -> -1 ->> 'programId')::int,
		graduation_modality_type_id = (s.extra->'uploadUndo' -> -1 ->> 'graduationModalityTypeId')::int,
		extra = CASE
			WHEN jsonb_array_length(s.extra->'uploadUndo') <= 1 THEN s.extra - 'uploadUndo'
			ELSE jsonb_set(s.extra, '{uploadUndo}', (s.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (s.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM academic.students WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_student_sections(
	p_rows jsonb,
	p_academic_period_id integer,
	p_user_id integer,
	p_source_file text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total integer := jsonb_array_length(p_rows);
	v_has_errors boolean := false;
	v_log_id integer;
	r record;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

	-- intra-file duplicate (section, student)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'sectionCode')), lower(trim(e->>'studentCode'))) IN (
			SELECT lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'sectionCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'studentCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int              AS row_number,
			NULLIF(trim(e->>'sectionCode'), '') AS section_code,
			NULLIF(trim(e->>'studentCode'), '') AS student_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.section_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionNotFound'::text, NULL::integer;
		END IF;

		IF r.student_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.students st WHERE st.code = r.student_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentNotFound'::text, NULL::integer;
		END IF;

		-- the student must be enrolled in the SAME study_plan_academic_period as the section
		IF r.section_code IS NOT NULL AND r.student_code IS NOT NULL
		   AND EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code)
		   AND EXISTS (SELECT 1 FROM academic.students st WHERE st.code = r.student_code)
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.course_sections cs
			JOIN academic.students st ON st.code = r.student_code
			JOIN academic.enrolled_students es ON es.student_id = st.id
			JOIN academic.study_plan_academic_periods spap_es
				ON spap_es.id = es.study_plan_academic_period AND spap_es.academic_period_id = cs.academic_period_id
			WHERE cs.section_code = r.section_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanPeriodMismatch'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T010'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert enrollments that do not exist yet (uniqueness = enrolled_student + course_section)
	INSERT INTO academic.student_section_enrollments
		(enrolled_student_id, course_section_id, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT es.id, cs.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.students st ON st.code = trim(e->>'studentCode')
	JOIN academic.enrolled_students es ON es.student_id = st.id
	JOIN academic.study_plan_academic_periods spap_es
		ON spap_es.id = es.study_plan_academic_period AND spap_es.academic_period_id = cs.academic_period_id
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.student_section_enrollments sse
		WHERE sse.enrolled_student_id = es.id AND sse.course_section_id = cs.id
	);

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_student_sections(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if an enrollment created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM evidence.student_course_outcome_grades g
		JOIN academic.student_section_enrollments sse ON sse.id = g.student_section_enrollment_id
		WHERE sse.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evaluation.project_students ps
		JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
		WHERE sse.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.student_course_grades scg
		JOIN academic.student_section_enrollments sse ON sse.id = scg.student_section_enrollment_id
		WHERE sse.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedSectionEnrollmentRefs';
	END IF;

	DELETE FROM academic.student_section_enrollments WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_grades_rc(
	p_rows jsonb,
	p_academic_period_id integer,
	p_user_id integer,
	p_source_file text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total integer := jsonb_array_length(p_rows);
	v_has_errors boolean := false;
	v_log_id integer;
	r record;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

	-- intra-file duplicate (section, student, grade type)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'sectionCode')), lower(trim(e->>'studentCode')), lower(trim(e->>'gradeTypeCode'))) IN (
			SELECT lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode')), lower(trim(d->>'gradeTypeCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'sectionCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'studentCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'gradeTypeCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode')), lower(trim(d->>'gradeTypeCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                       AS row_number,
			NULLIF(trim(e->>'sectionCode'), '')          AS section_code,
			NULLIF(trim(e->>'studentCode'), '')          AS student_code,
			NULLIF(trim(e->>'gradeTypeCode'), '')        AS grade_type_code,
			NULLIF(trim(e->>'gradeTypePercentage'), '')  AS grade_type_percentage,
			NULLIF(trim(e->>'grade'), '')                AS grade
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.section_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionNotFound'::text, NULL::integer;
		END IF;

		IF r.student_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.students st WHERE st.code = r.student_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentNotFound'::text, NULL::integer;
		END IF;

		-- the student must be enrolled in that section (student_section_enrollment exists)
		IF r.section_code IS NOT NULL AND r.student_code IS NOT NULL
		   AND EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code)
		   AND EXISTS (SELECT 1 FROM academic.students st WHERE st.code = r.student_code)
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.student_section_enrollments sse
			JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
			JOIN academic.students st ON st.id = es.student_id
			WHERE cs.section_code = r.section_code AND st.code = r.student_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'enrollmentNotFound'::text, NULL::integer;
		END IF;

		IF r.grade_type_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeTypeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1 FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG205' AND t.code = r.grade_type_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeTypeInvalid'::text, NULL::integer;
		END IF;

		IF r.grade_type_percentage IS NULL OR r.grade_type_percentage !~ '^[0-9]+(\\.[0-9]+)?$' THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeTypePercentageInvalid'::text, NULL::integer;
		END IF;

		IF r.grade IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeEmpty'::text, NULL::integer;
		ELSIF r.grade !~ '^-?[0-9]+(\\.[0-9]+)?$' THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T008'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert grades that do not exist yet (uniqueness = enrollment + grade_type)
	INSERT INTO academic.student_course_grades
		(student_section_enrollment_id, grade_type_id, grade_type_percentage, grade, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		sse.id, t.id, (e->>'gradeTypePercentage')::numeric, (e->>'grade')::numeric, v_log_id,
		'{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN core.type_groups g ON g.code = 'TG205'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'gradeTypeCode')
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.student_course_grades scg
		WHERE scg.student_section_enrollment_id = sse.id AND scg.grade_type_id = t.id
	);

	-- update grades that already existed (push prior values onto the extra.uploadUndo stack)
	UPDATE academic.student_course_grades scg
	SET grade_type_percentage = (e->>'gradeTypePercentage')::numeric,
		grade = (e->>'grade')::numeric,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(scg.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(scg.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'gradeTypePercentage', scg.grade_type_percentage, 'grade', scg.grade))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN core.type_groups g ON g.code = 'TG205'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'gradeTypeCode')
	WHERE scg.student_section_enrollment_id = sse.id
	  AND scg.grade_type_id = t.id
	  AND scg.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_grades_rc(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM academic.student_course_grades scg
		WHERE (scg.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (scg.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.student_course_grades scg
		WHERE scg.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(scg.extra->'uploadUndo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated grades by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE academic.student_course_grades scg
	SET grade_type_percentage = (scg.extra->'uploadUndo' -> -1 ->> 'gradeTypePercentage')::numeric,
		grade = (scg.extra->'uploadUndo' -> -1 ->> 'grade')::numeric,
		extra = CASE
			WHEN jsonb_array_length(scg.extra->'uploadUndo') <= 1 THEN scg.extra - 'uploadUndo'
			ELSE jsonb_set(scg.extra, '{uploadUndo}', (scg.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (scg.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM academic.student_course_grades WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_grades_rv(
	p_rows jsonb,
	p_academic_period_id integer,
	p_user_id integer,
	p_source_file text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total integer := jsonb_array_length(p_rows);
	v_has_errors boolean := false;
	v_log_id integer;
	r record;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

	-- intra-file duplicate (section, student, outcome)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'sectionCode')), lower(trim(e->>'studentCode')), lower(trim(e->>'outcomeCode'))) IN (
			SELECT lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode')), lower(trim(d->>'outcomeCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'sectionCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'studentCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'outcomeCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode')), lower(trim(d->>'outcomeCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int               AS row_number,
			NULLIF(trim(e->>'sectionCode'), '')  AS section_code,
			NULLIF(trim(e->>'studentCode'), '')  AS student_code,
			NULLIF(trim(e->>'outcomeCode'), '')  AS outcome_code,
			NULLIF(trim(e->>'grade'), '')        AS grade
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.section_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionNotFound'::text, NULL::integer;
		END IF;

		IF r.student_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.students st WHERE st.code = r.student_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentNotFound'::text, NULL::integer;
		END IF;

		-- the student must be enrolled in that section (student_section_enrollment exists)
		IF r.section_code IS NOT NULL AND r.student_code IS NOT NULL
		   AND EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code)
		   AND EXISTS (SELECT 1 FROM academic.students st WHERE st.code = r.student_code)
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.student_section_enrollments sse
			JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
			JOIN academic.students st ON st.id = es.student_id
			WHERE cs.section_code = r.section_code AND st.code = r.student_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'enrollmentNotFound'::text, NULL::integer;
		END IF;

		IF r.outcome_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM accreditation.outcomes o WHERE o.outcome_code = r.outcome_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeNotFound'::text, NULL::integer;
		END IF;

		-- the outcome must be mapped to the section's course (course_outcome_mappings on its study_plan_course)
		IF r.section_code IS NOT NULL AND r.outcome_code IS NOT NULL
		   AND EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code)
		   AND EXISTS (SELECT 1 FROM accreditation.outcomes o WHERE o.outcome_code = r.outcome_code)
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.course_sections cs
			JOIN academic.study_plan_courses spc_com ON spc_com.course_id = cs.course_id
			JOIN academic.course_outcome_mappings com ON com.study_plan_course_id = spc_com.id
			JOIN accreditation.outcomes o ON o.id = com.outcome_id
			WHERE cs.section_code = r.section_code AND o.outcome_code = r.outcome_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeNotInSection'::text, NULL::integer;
		END IF;

		IF r.grade IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeEmpty'::text, NULL::integer;
		ELSIF r.grade !~ '^-?[0-9]+(\\.[0-9]+)?$' THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T007'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert outcome grades that do not exist yet (uniqueness = enrollment + outcome)
	INSERT INTO evidence.student_course_outcome_grades
		(student_section_enrollment_id, outcome_id, grade, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		sse.id, o.id, (e->>'grade')::numeric, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN accreditation.outcomes o ON o.outcome_code = trim(e->>'outcomeCode')
	WHERE NOT EXISTS (
		SELECT 1 FROM evidence.student_course_outcome_grades g
		WHERE g.student_section_enrollment_id = sse.id AND g.outcome_id = o.id
	);

	-- update outcome grades that already existed (push prior grade onto the extra.uploadUndo stack)
	UPDATE evidence.student_course_outcome_grades g
	SET grade = (e->>'grade')::numeric,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(g.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(g.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'grade', g.grade))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN accreditation.outcomes o ON o.outcome_code = trim(e->>'outcomeCode')
	WHERE g.student_section_enrollment_id = sse.id
	  AND g.outcome_id = o.id
	  AND g.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_grades_rv(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM evidence.student_course_outcome_grades g
		WHERE (g.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (g.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evidence.student_course_outcome_grades g
		WHERE g.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(g.extra->'uploadUndo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated grades by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE evidence.student_course_outcome_grades g
	SET grade = (g.extra->'uploadUndo' -> -1 ->> 'grade')::numeric,
		extra = CASE
			WHEN jsonb_array_length(g.extra->'uploadUndo') <= 1 THEN g.extra - 'uploadUndo'
			ELSE jsonb_set(g.extra, '{uploadUndo}', (g.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (g.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM evidence.student_course_outcome_grades WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_grades_rv(integer)`);
		await queryRunner.query(
			`DROP FUNCTION IF EXISTS audit.fn_upload_grades_rv(jsonb, integer, integer, text)`,
		);
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_grades_rc(integer)`);
		await queryRunner.query(
			`DROP FUNCTION IF EXISTS audit.fn_upload_grades_rc(jsonb, integer, integer, text)`,
		);
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_student_sections(integer)`);
		await queryRunner.query(
			`DROP FUNCTION IF EXISTS audit.fn_upload_student_sections(jsonb, integer, integer, text)`,
		);
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_enrolled_students(integer)`);
		await queryRunner.query(
			`DROP FUNCTION IF EXISTS audit.fn_upload_enrolled_students(jsonb, integer, integer, text)`,
		);
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_sections(integer)`);
		await queryRunner.query(
			`DROP FUNCTION IF EXISTS audit.fn_upload_sections(jsonb, integer, integer, text)`,
		);
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_articulation(integer)`);
		await queryRunner.query(
			`DROP FUNCTION IF EXISTS audit.fn_upload_articulation(jsonb, integer, integer, text)`,
		);
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_outcomes(integer)`);
		await queryRunner.query(
			`DROP FUNCTION IF EXISTS audit.fn_upload_outcomes(jsonb, integer, integer, text)`,
		);
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_charts(integer)`);
		await queryRunner.query(
			`DROP FUNCTION IF EXISTS audit.fn_upload_charts(jsonb, integer, integer, text)`,
		);
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_staff(integer)`);
		await queryRunner.query(
			`DROP FUNCTION IF EXISTS audit.fn_upload_staff(jsonb, integer, integer, text)`,
		);
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_study_plans(integer)`);
		await queryRunner.query(
			`DROP FUNCTION IF EXISTS audit.fn_upload_study_plans(jsonb, integer, integer, text)`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."role_module_permissions" DROP CONSTRAINT "FK_rmp_permission_type"`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."role_module_permissions" DROP CONSTRAINT "FK_rmp_module_type"`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."role_module_permissions" DROP CONSTRAINT "FK_rmp_role"`,
		);
		await queryRunner.query(`ALTER TABLE "core"."user_roles" DROP CONSTRAINT "FK_user_roles_role"`);
		await queryRunner.query(`ALTER TABLE "core"."user_roles" DROP CONSTRAINT "FK_user_roles_user"`);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_outcome_mappings" DROP CONSTRAINT "FK_course_outcome_mappings_study_plan_course_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_outcome_mappings" DROP CONSTRAINT "FK_course_outcome_mappings_outcome_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."performance_levels" DROP CONSTRAINT "FK_performance_levels_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_course_grades" DROP CONSTRAINT "FK_student_course_grades_student_section_enrollment_id"`,
		);
		await queryRunner.query(`ALTER TABLE "core"."types" DROP CONSTRAINT "FK_types_type_group_id"`);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_questions" DROP CONSTRAINT "FK_rubric_questions_outcome_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_questions" DROP CONSTRAINT "FK_rubric_questions_rubric_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_scores" DROP CONSTRAINT "FK_rubric_scores_rubric_question_criteria_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_scores" DROP CONSTRAINT "FK_rubric_scores_evaluation_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubrics" DROP CONSTRAINT "FK_rubrics_study_plan_course_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubrics" DROP CONSTRAINT "FK_rubrics_grade_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubrics" DROP CONSTRAINT "FK_rubrics_rubric_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" DROP CONSTRAINT "FK_evaluations_project_evaluator_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" DROP CONSTRAINT "FK_evaluations_project_student_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_students" DROP CONSTRAINT "FK_project_students_student_section_enrollment_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_students" DROP CONSTRAINT "FK_project_students_project_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" DROP CONSTRAINT "FK_project_evaluators_professor_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" DROP CONSTRAINT "FK_project_evaluators_project_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."student_course_outcome_grades" DROP CONSTRAINT "FK_student_course_outcome_grades_outcome_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."student_course_outcome_grades" DROP CONSTRAINT "FK_student_course_outcome_grades_student_section_enrollment_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_section_enrollments" DROP CONSTRAINT "FK_student_section_enrollments_course_section_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_section_enrollments" DROP CONSTRAINT "FK_student_section_enrollments_enrolled_student_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" DROP CONSTRAINT "FK_enrolled_students_campus_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" DROP CONSTRAINT "FK_enrolled_students_student_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_logs" DROP CONSTRAINT "FK_notification_logs_notifier_user_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_logs" DROP CONSTRAINT "FK_notification_logs_notification_config_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_logs" DROP CONSTRAINT "FK_notification_logs_chart_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_logs" DROP CONSTRAINT "FK_notification_logs_ifc_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."users" DROP CONSTRAINT "FK_users_document_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" DROP CONSTRAINT "FK_notification_configs_ifc_status_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" DROP CONSTRAINT "FK_notification_configs_trigger_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" DROP CONSTRAINT "FK_notification_configs_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" DROP CONSTRAINT "FK_notification_configs_school_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."ifc_findings" DROP CONSTRAINT "FK_ifc_findings_finding_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."ifc_findings" DROP CONSTRAINT "FK_ifc_findings_ifc_id"`,
		);
		await queryRunner.query(`ALTER TABLE "ifc"."statuses" DROP CONSTRAINT "FK_statuses_staff_id"`);
		await queryRunner.query(`ALTER TABLE "ifc"."statuses" DROP CONSTRAINT "FK_statuses_ifc_id"`);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ifcs" DROP CONSTRAINT "FK_ifcs_academic_period_id"`,
		);
		await queryRunner.query(`ALTER TABLE "evidence"."ifcs" DROP CONSTRAINT "FK_ifcs_course_id"`);
		await queryRunner.query(
			`ALTER TABLE "improvement"."finding_outcomes" DROP CONSTRAINT "FK_finding_outcomes_outcome_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."finding_outcomes" DROP CONSTRAINT "FK_finding_outcomes_finding_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."plan_actions" DROP CONSTRAINT "FK_plan_actions_finding_action_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."plan_actions" DROP CONSTRAINT "FK_plan_actions_plan_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."finding_actions" DROP CONSTRAINT "FK_finding_actions_action_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."finding_actions" DROP CONSTRAINT "FK_finding_actions_finding_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" DROP CONSTRAINT "FK_findings_campus_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" DROP CONSTRAINT "FK_findings_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" DROP CONSTRAINT "FK_findings_course_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" DROP CONSTRAINT "FK_findings_criticality_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" DROP CONSTRAINT "FK_findings_staff_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" DROP CONSTRAINT "FK_findings_instrument_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."actions" DROP CONSTRAINT "FK_actions_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."actions" DROP CONSTRAINT "FK_actions_program_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."plans" DROP CONSTRAINT "FK_plans_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."plans" DROP CONSTRAINT "FK_plans_program_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."charts" DROP CONSTRAINT "FK_charts_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."charts" DROP CONSTRAINT "FK_charts_level_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."charts" DROP CONSTRAINT "FK_charts_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."charts" DROP CONSTRAINT "FK_charts_staff_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."schools" DROP CONSTRAINT "FK_schools_faculty_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."notification_messages" DROP CONSTRAINT "FK_notification_messages_program_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."notifications" DROP CONSTRAINT "FK_notifications_survey_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."outcome_configs" DROP CONSTRAINT "FK_outcome_configs_outcome_id"`,
		);
		await queryRunner.query(`ALTER TABLE "survey"."scores" DROP CONSTRAINT "FK_scores_outcome_id"`);
		await queryRunner.query(`ALTER TABLE "survey"."scores" DROP CONSTRAINT "FK_scores_survey_id"`);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" DROP CONSTRAINT "FK_surveys_course_section_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" DROP CONSTRAINT "FK_surveys_program_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" DROP CONSTRAINT "FK_surveys_campus_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" DROP CONSTRAINT "FK_surveys_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" DROP CONSTRAINT "FK_surveys_student_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" DROP CONSTRAINT "FK_students_program_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" DROP CONSTRAINT "FK_students_user_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" DROP CONSTRAINT "FK_course_sections_professor_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" DROP CONSTRAINT "FK_course_sections_campus_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" DROP CONSTRAINT "FK_course_sections_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" DROP CONSTRAINT "FK_course_sections_course_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_courses" DROP CONSTRAINT "FK_study_plan_courses_course_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_courses" DROP CONSTRAINT "FK_study_plan_courses_study_plan_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_academic_periods" DROP CONSTRAINT "FK_study_plan_academic_periods_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_academic_periods" DROP CONSTRAINT "FK_study_plan_academic_periods_study_plan_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plans" DROP CONSTRAINT "FK_study_plans_program_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "audit"."upload_logs" DROP CONSTRAINT "FK_upload_logs_status_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "audit"."upload_logs" DROP CONSTRAINT "FK_upload_logs_upload_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "audit"."upload_logs" DROP CONSTRAINT "FK_upload_logs_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "audit"."upload_logs" DROP CONSTRAINT "FK_upload_logs_user_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."professors" DROP CONSTRAINT "FK_professors_staff_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."staff" DROP CONSTRAINT "FK_staff_user_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."outcomes" DROP CONSTRAINT "FK_outcomes_program_commission_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."program_commissions" DROP CONSTRAINT "FK_program_commissions_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."program_commissions" DROP CONSTRAINT "FK_program_commissions_program_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."program_commissions" DROP CONSTRAINT "FK_program_commissions_commission_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."commissions" DROP CONSTRAINT "FK_commissions_accreditor_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_outcome_mappings" DROP CONSTRAINT "FK_course_outcome_mappings_outcome_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."performance_levels" DROP CONSTRAINT "FK_performance_levels_instrument_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_course_grades" DROP CONSTRAINT "FK_student_course_grades_grade_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" DROP CONSTRAINT "FK_evaluations_qualification_status_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" DROP CONSTRAINT "FK_project_evaluators_evaluator_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_question_criterias" DROP CONSTRAINT "FK_rubric_question_criterias_rubric_question_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" DROP CONSTRAINT "FK_enrolled_students_enrollement_modality_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."statuses" DROP CONSTRAINT "FK_statuses_status_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."instruments" DROP CONSTRAINT "FK_instruments_constituent_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."notification_messages" DROP CONSTRAINT "FK_notification_messages_survey_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."notifications" DROP CONSTRAINT "FK_notifications_notification_status_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" DROP CONSTRAINT "FK_surveys_survey_status_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" DROP CONSTRAINT "FK_surveys_survey_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" DROP CONSTRAINT "FK_students_graduation_modality_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" DROP CONSTRAINT "FK_course_sections_section_modality_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_courses" DROP CONSTRAINT "FK_study_plan_courses_level_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_section_enrollments" DROP CONSTRAINT "FK_student_section_enrollments_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."student_course_outcome_grades" DROP CONSTRAINT "FK_student_course_outcome_grades_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_course_grades" DROP CONSTRAINT "FK_student_course_grades_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" DROP CONSTRAINT "FK_enrolled_students_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" DROP CONSTRAINT "FK_students_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" DROP CONSTRAINT "FK_course_sections_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_outcome_mappings" DROP CONSTRAINT "FK_course_outcome_mappings_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."outcomes" DROP CONSTRAINT "FK_outcomes_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."professors" DROP CONSTRAINT "FK_professors_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."staff" DROP CONSTRAINT "FK_staff_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_courses" DROP CONSTRAINT "FK_study_plan_courses_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."courses" DROP CONSTRAINT "FK_courses_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plans" DROP CONSTRAINT "FK_study_plans_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."staff" DROP CONSTRAINT "FK_staff_position_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."program_commissions" DROP CONSTRAINT "FK_program_commissions_commission_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."programs" DROP CONSTRAINT "FK_programs_modality_type_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."academic_periods" DROP CONSTRAINT "FK_academic_periods_modality_type_id"`,
		);
		await queryRunner.query(`DROP INDEX "core"."IDX_role_module_permissions_lookup"`);
		await queryRunner.query(`DROP TABLE "core"."role_module_permissions"`);
		await queryRunner.query(`DROP INDEX "core"."IDX_user_roles_user_active"`);
		await queryRunner.query(`DROP TABLE "core"."user_roles"`);
		await queryRunner.query(`DROP TABLE "core"."roles"`);
		await queryRunner.query(`DROP TABLE "academic"."course_outcome_mappings"`);
		await queryRunner.query(`DROP TABLE "academic"."performance_levels"`);
		await queryRunner.query(`DROP TABLE "academic"."student_course_grades"`);
		await queryRunner.query(`DROP TABLE "core"."parameters"`);
		await queryRunner.query(`DROP TABLE "core"."types"`);
		await queryRunner.query(`DROP TABLE "core"."type_groups"`);
		await queryRunner.query(`DROP TABLE "evaluation"."rubric_questions"`);
		await queryRunner.query(`DROP TABLE "evaluation"."rubric_scores"`);
		await queryRunner.query(`DROP TABLE "evaluation"."rubric_question_criterias"`);
		await queryRunner.query(`DROP TABLE "evaluation"."rubrics"`);
		await queryRunner.query(`DROP TABLE "evidence"."evaluations"`);
		await queryRunner.query(`DROP TABLE "evaluation"."project_students"`);
		await queryRunner.query(`DROP TABLE "evaluation"."project_evaluators"`);
		await queryRunner.query(`DROP TABLE "evaluation"."projects"`);
		await queryRunner.query(`DROP TABLE "evidence"."student_course_outcome_grades"`);
		await queryRunner.query(`DROP TABLE "academic"."student_section_enrollments"`);
		await queryRunner.query(`DROP TABLE "academic"."enrolled_students"`);
		await queryRunner.query(`DROP INDEX "ifc"."IDX_notification_logs_ifc_id"`);
		await queryRunner.query(`DROP INDEX "ifc"."IDX_notification_logs_chart_id"`);
		await queryRunner.query(`DROP TABLE "ifc"."notification_logs"`);
		await queryRunner.query(`DROP TABLE "ifc"."notification_configs"`);
		await queryRunner.query(`DROP TABLE "ifc"."ifc_findings"`);
		await queryRunner.query(`DROP TABLE "ifc"."statuses"`);
		await queryRunner.query(`DROP INDEX "evidence"."IDX_ifcs_course_period"`);
		await queryRunner.query(`DROP TABLE "evidence"."ifcs"`);
		await queryRunner.query(`DROP TABLE "improvement"."finding_outcomes"`);
		await queryRunner.query(`DROP TABLE "improvement"."plan_actions"`);
		await queryRunner.query(`DROP TABLE "improvement"."finding_actions"`);
		await queryRunner.query(`DROP INDEX "improvement"."IDX_findings_course_period"`);
		await queryRunner.query(`DROP TABLE "improvement"."findings"`);
		await queryRunner.query(`DROP TABLE "evidence"."instruments"`);
		await queryRunner.query(`DROP TABLE "improvement"."actions"`);
		await queryRunner.query(`DROP TABLE "improvement"."plans"`);
		await queryRunner.query(`DROP TABLE "organization"."charts"`);
		await queryRunner.query(`DROP TABLE "organization"."schools"`);
		await queryRunner.query(`DROP TABLE "organization"."faculties"`);
		await queryRunner.query(`DROP TABLE "survey"."notification_messages"`);
		await queryRunner.query(`DROP TABLE "survey"."notifications"`);
		await queryRunner.query(`DROP TABLE "survey"."outcome_configs"`);
		await queryRunner.query(`DROP TABLE "survey"."scores"`);
		await queryRunner.query(`DROP TABLE "evidence"."surveys"`);
		await queryRunner.query(`DROP TABLE "academic"."students"`);
		await queryRunner.query(`DROP TABLE "academic"."course_sections"`);
		await queryRunner.query(`DROP TABLE "academic"."study_plan_courses"`);
		await queryRunner.query(`DROP TABLE "academic"."study_plan_academic_periods"`);
		await queryRunner.query(`DROP TABLE "academic"."study_plans"`);
		await queryRunner.query(`DROP TABLE "academic"."courses"`);
		await queryRunner.query(`DROP TABLE "academic"."professors"`);
		await queryRunner.query(`DROP TABLE "organization"."staff"`);
		await queryRunner.query(`DROP TABLE "audit"."upload_logs"`);
		await queryRunner.query(`DROP TABLE "organization"."users"`);
		await queryRunner.query(`DROP TABLE "organization"."campuses"`);
		await queryRunner.query(`DROP TABLE "accreditation"."outcomes"`);
		await queryRunner.query(`DROP TABLE "accreditation"."program_commissions"`);
		await queryRunner.query(`DROP TABLE "academic"."programs"`);
		await queryRunner.query(`DROP TABLE "accreditation"."commissions"`);
		await queryRunner.query(`DROP TABLE "accreditation"."accreditors"`);
		await queryRunner.query(`DROP INDEX "academic"."IDX_academic_periods_year"`);
		await queryRunner.query(`DROP TABLE "academic"."academic_periods"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "typeorm_metadata"`);
	}
}
