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
			`CREATE TABLE "accreditation"."outcomes" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "program_commission_id" integer NOT NULL, "outcome_code" character varying(50) NOT NULL, "outcome_name" jsonb NOT NULL DEFAULT '{}'::jsonb, "outcome_description" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_outcomes_outcome_code" UNIQUE ("outcome_code"), CONSTRAINT "PK_outcomes" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."campuses" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(255) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_campuses" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."users" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "document_type_id" integer NOT NULL, "document_code" integer NOT NULL, "first_name" character varying(255) NOT NULL, "last_name" character varying(255) NOT NULL, "email" character varying(254) NOT NULL, "phone" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "is_admin" boolean DEFAULT false, CONSTRAINT "PK_users" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."staff" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "user_id" integer NOT NULL, "position_type_id" integer NOT NULL, "job_title" jsonb NOT NULL DEFAULT '{}'::jsonb, "job_description" jsonb NOT NULL DEFAULT '{}'::jsonb, "staff_email" character varying(255) NOT NULL, "staff_phone" character varying(255) NOT NULL, CONSTRAINT "PK_staff" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."professors" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "staff_id" integer NOT NULL, "code" character varying(50) NOT NULL, CONSTRAINT "UQ_professors_code" UNIQUE ("code"), CONSTRAINT "PK_professors" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."courses" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb NOT NULL DEFAULT '{}'::jsonb, "learning_outcome" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_courses_code" UNIQUE ("code"), CONSTRAINT "PK_courses" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."study_plans" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "program_id" integer NOT NULL, "code" character varying(10) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_study_plans_code" UNIQUE ("code"), CONSTRAINT "PK_study_plans" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."study_plan_academic_periods" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "study_plan_id" integer NOT NULL, "academic_period_id" integer NOT NULL, CONSTRAINT "PK_study_plan_academic_periods" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."study_plan_courses" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "study_plan_academic_period_id" integer NOT NULL, "course_id" integer NOT NULL, "is_elective" boolean NOT NULL DEFAULT false, "level_type_id" integer NOT NULL, CONSTRAINT "PK_study_plan_courses" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."course_sections" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "study_plan_course_id" integer NOT NULL, "campus_id" integer NOT NULL, "professor_id" integer NOT NULL, "section_code" character varying(50) NOT NULL, "schedule" jsonb DEFAULT '{}'::jsonb, "section_modality_type_id" integer NOT NULL, CONSTRAINT "UQ_course_sections_section_code" UNIQUE ("section_code"), CONSTRAINT "PK_course_sections" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."students" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "user_id" integer NOT NULL, "program_id" integer NOT NULL, "graduation_modality_type_id" integer NOT NULL, CONSTRAINT "PK_students" PRIMARY KEY ("id"))`,
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
			`CREATE TABLE "organization"."chart_levels" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "level" integer NOT NULL, "level_type_id" integer NOT NULL, CONSTRAINT "PK_chart_levels" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."charts" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "staff_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "chart_level_id" integer NOT NULL, "root_chart_detail_id" integer, "level_title" jsonb NOT NULL DEFAULT '{}'::jsonb, "entity_type_id" integer, "entity_code" integer, CONSTRAINT "PK_charts" PRIMARY KEY ("id"))`,
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
			`CREATE TABLE "academic"."enrolled_students" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "student_id" integer NOT NULL, "study_plan_academic_period" integer NOT NULL, "campus_id" integer NOT NULL, "enrollement_modality_type_id" integer NOT NULL, CONSTRAINT "PK_enrolled_students" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."student_section_enrollments" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "enrolled_student_id" integer NOT NULL, "course_section_id" integer NOT NULL, CONSTRAINT "PK_student_section_enrollments" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evidence"."student_course_outcome_grades" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "student_section_enrollment_id" integer NOT NULL, "outcome_id" integer NOT NULL, "grade" numeric(12,6) NOT NULL, CONSTRAINT "PK_student_course_outcome_grades" PRIMARY KEY ("id"))`,
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
			`CREATE TABLE "academic"."student_course_grades" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "student_section_enrollment_id" integer NOT NULL, "grade_type_id" integer NOT NULL, "grade_type_percentage" numeric(12,6) NOT NULL, "grade" numeric(12,6) NOT NULL, CONSTRAINT "PK_student_course_grades" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."performance_levels" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "instrument_type_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "code" character varying(50) NOT NULL, "unique_value" numeric(12,6) NOT NULL, "min_score" numeric(12,6) NOT NULL, "max_score" numeric(12,6) NOT NULL, "max_value" numeric(12,6) NOT NULL, CONSTRAINT "UQ_performance_levels_code" UNIQUE ("code"), CONSTRAINT "PK_performance_levels" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."course_outcome_mappings" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "outcome_id" integer NOT NULL, "study_plan_course_id" integer NOT NULL, "outcome_type_id" integer NOT NULL, CONSTRAINT "PK_course_outcome_mappings" PRIMARY KEY ("id"))`,
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
			`ALTER TABLE "academic"."course_sections" ADD CONSTRAINT "FK_course_sections_study_plan_course_id" FOREIGN KEY ("study_plan_course_id") REFERENCES "academic"."study_plan_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
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
			`ALTER TABLE "organization"."charts" ADD CONSTRAINT "FK_charts_chart_level_id" FOREIGN KEY ("chart_level_id") REFERENCES "organization"."chart_levels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
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
			`ALTER TABLE "organization"."chart_levels" ADD CONSTRAINT "FK_chart_levels_level_type_id" FOREIGN KEY ("level_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
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
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
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
			`ALTER TABLE "organization"."charts" DROP CONSTRAINT "FK_charts_chart_level_id"`,
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
			`ALTER TABLE "academic"."course_sections" DROP CONSTRAINT "FK_course_sections_study_plan_course_id"`,
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
			`ALTER TABLE "organization"."chart_levels" DROP CONSTRAINT "FK_chart_levels_level_type_id"`,
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
		await queryRunner.query(`DROP TABLE "organization"."chart_levels"`);
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
