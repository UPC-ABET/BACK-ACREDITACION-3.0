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
			`CREATE TABLE "academic"."academic_periods" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "modality_type_id" integer NOT NULL, "code" character varying(1000) NOT NULL, "start_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "end_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "year" integer GENERATED ALWAYS AS (EXTRACT(YEAR FROM ("start_date" AT TIME ZONE 'UTC'))::int) STORED, CONSTRAINT "PK_911f414fba24e3855a5ba1f51ad" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(`CREATE INDEX "idx_academic_periods_year" ON "academic"."academic_periods" ("year")`);
		await queryRunner.query(
			`CREATE TABLE "accreditation"."accreditors" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(1000) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_db5d514f1f3dbbd718f2f8feaf0" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "accreditation"."commissions" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "accreditor_id" integer NOT NULL, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_feab7a246fd5bd9eee8a00e655c" UNIQUE ("code"), CONSTRAINT "PK_2701379966e2e670bb5ff0ae78e" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."programs" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "modality_type_id" integer NOT NULL, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "degree" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_11924ca2e0cb47a8d9400bada03" UNIQUE ("code"), CONSTRAINT "PK_d43c664bcaafc0e8a06dfd34e05" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "accreditation"."program_commissions" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "commission_id" integer NOT NULL, "program_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "commission_type_id" integer NOT NULL, CONSTRAINT "PK_802df6ce3143654610a2cbb7853" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "accreditation"."outcomes" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "program_commission_id" integer NOT NULL, "outcome_code" character varying(50) NOT NULL, "outcome_name" jsonb NOT NULL DEFAULT '{}'::jsonb, "outcome_description" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_db7ef6d23e512a822d661a2d793" UNIQUE ("outcome_code"), CONSTRAINT "PK_f5b8391e8300f8962eb1842dfca" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."campuses" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(1000) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_d6a06870edd505bfc2d002cb728" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."users" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "document_type_id" integer NOT NULL, "document_code" integer NOT NULL, "first_name" character varying(1000) NOT NULL, "last_name" character varying(1000) NOT NULL, "email" character varying(1000) NOT NULL, "phone" character varying(1000) NOT NULL, "password" character varying(1000) NOT NULL, "is_admin" boolean DEFAULT false, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."staff" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "user_id" integer NOT NULL, "position_type_id" integer NOT NULL, "job_title" jsonb NOT NULL DEFAULT '{}'::jsonb, "job_description" jsonb NOT NULL DEFAULT '{}'::jsonb, "staff_email" character varying(1000) NOT NULL, "staff_phone" character varying(1000) NOT NULL, CONSTRAINT "PK_e4ee98bb552756c180aec1e854a" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."professors" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "staff_id" integer NOT NULL, "code" character varying(50) NOT NULL, CONSTRAINT "UQ_ACADEMIC_PROFESSORS_CODE" UNIQUE ("code"), CONSTRAINT "PK_6b249c6363a154820c909c45e27" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."courses" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb NOT NULL DEFAULT '{}'::jsonb, "learning_outcome" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_ACADEMIC_COURSES_CODE" UNIQUE ("code"), CONSTRAINT "PK_3f70a487cc718ad8eda4e6d58c9" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."study_plans" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "program_id" integer NOT NULL, "code" character varying(10) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_062984535cc33c18b7ced0ded63" UNIQUE ("code"), CONSTRAINT "PK_0e9610ccbc3b79324da329edb33" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."study_plan_academic_periods" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "study_plan_id" integer NOT NULL, "academic_period_id" integer NOT NULL, CONSTRAINT "PK_10ae889a6f4d93e1173a391b9a4" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."study_plan_courses" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "study_plan_academic_period_id" integer NOT NULL, "course_id" integer NOT NULL, "is_elective" boolean NOT NULL DEFAULT false, "level_type_id" integer NOT NULL, CONSTRAINT "PK_d910c3766a5a0fd283ff9d287a5" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."course_sections" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "study_plan_course_id" integer NOT NULL, "campus_id" integer NOT NULL, "professor_id" integer NOT NULL, "section_code" character varying(50) NOT NULL, "schedule" jsonb DEFAULT '{}'::jsonb, "section_modality_type_id" integer NOT NULL, CONSTRAINT "UQ_39408d8e20866b0d10f315e2d2c" UNIQUE ("section_code"), CONSTRAINT "PK_03086ef0602f2721612a5ce610d" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."students" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "user_id" integer NOT NULL, "program_id" integer NOT NULL, "graduation_modality_type_id" integer NOT NULL, CONSTRAINT "PK_7d7f07271ad4ce999880713f05e" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evidence"."surveys" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "survey_type_id" integer NOT NULL, "survey_status_type_id" integer NOT NULL, "student_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "campus_id" integer NOT NULL, "program_id" integer NOT NULL, "information" jsonb DEFAULT '{}'::jsonb, "survey_number" integer, "course_section_id" integer NOT NULL, CONSTRAINT "PK_1b5e3d4aaeb2321ffa98498c971" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "survey"."scores" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "survey_id" integer NOT NULL, "outcome_id" integer NOT NULL, "score" numeric(12,6) NOT NULL, "commentaries" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "PK_c36917e6f26293b91d04b8fd521" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "survey"."outcome_configs" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "outcome_id" integer NOT NULL, "user_outcome_name" jsonb NOT NULL DEFAULT '{}'::jsonb, "user_outcome_description" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "PK_bc6dbcd1cb0f388ea81fc8f4544" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "survey"."notifications" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "survey_id" integer NOT NULL, "notification_status_type_id" integer NOT NULL, "token" text NOT NULL, "sent_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "max_register_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "survey"."notification_messages" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "survey_type_id" integer NOT NULL, "program_id" integer NOT NULL, "title" jsonb NOT NULL DEFAULT '{}'::jsonb, "body" jsonb NOT NULL DEFAULT '{}'::jsonb, "cc_receivers" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "PK_025a03ac35a495f0a6d8730350d" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."faculties" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_f1b2cd43a96c6fb75c8ad44de88" UNIQUE ("code"), CONSTRAINT "PK_fd83e4a09c7182ccf7bdb3770b9" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."schools" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "faculty_id" integer NOT NULL, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_35e8277da52a915513e3ece8cf9" UNIQUE ("code"), CONSTRAINT "PK_95b932e47ac129dd8e23a0db548" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."chart_levels" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "level" integer NOT NULL, "level_type_id" integer NOT NULL, CONSTRAINT "PK_ff95582bc789db38d51aff20d59" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "organization"."charts" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "staff_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "chart_level_id" integer NOT NULL, "root_chart_detail_id" integer, "level_title" jsonb NOT NULL DEFAULT '{}'::jsonb, "entity_type_id" integer, "entity_code" integer, CONSTRAINT "PK_fa7124425552d2d37725307008b" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "improvement"."plans" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "program_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb DEFAULT '{}'::jsonb, "is_open" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_3720521a81c7c24fe9b7202ba61" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "improvement"."actions" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "description" jsonb NOT NULL DEFAULT '{}'::jsonb, "correlative" integer NOT NULL, "program_id" integer NOT NULL, "academic_period_id" integer NOT NULL, CONSTRAINT "PK_7bfb822f56be449c0b8adbf83cf" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evidence"."instruments" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "constituent_type_id" integer NOT NULL, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb DEFAULT '{}'::jsonb, "is_for_accreditation" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_40686155516c825c49583a52c07" UNIQUE ("code"), CONSTRAINT "PK_44d772c3199b38559c5fb666eb6" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "improvement"."findings" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "criticality_type_id" integer NOT NULL, "instrument_id" integer NOT NULL, "staff_id" integer, "correlative" integer NOT NULL, "description" jsonb DEFAULT '{}'::jsonb, "course_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "campus_id" integer, "is_automatic" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_ae9807d6293c23c13ff8804d09c" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "improvement"."finding_actions" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "finding_id" integer NOT NULL, "action_id" integer NOT NULL, "in_plan_required" boolean NOT NULL DEFAULT false, "evidences" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "PK_aa2c153cbc5da86a2819c2c4dae" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "improvement"."plan_actions" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "plan_id" integer NOT NULL, "finding_action_id" integer NOT NULL, CONSTRAINT "PK_c835bdda7f4948a712944d89e29" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "improvement"."finding_outcomes" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "finding_id" integer NOT NULL, "outcome_id" integer NOT NULL, CONSTRAINT "PK_a9b1f98202f160179933a5c2ac4" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evidence"."ifcs" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "course_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "information" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "PK_2bfd47d6b5d4eb31f3120596a41" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "ifc"."statuses" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "ifc_id" integer NOT NULL, "status_type_id" integer NOT NULL, "staff_id" integer NOT NULL, "comment" jsonb DEFAULT '{}'::jsonb, "register_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2fd3770acdb67736f1a3e3d5399" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "ifc"."ifc_findings" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "ifc_id" integer NOT NULL, "finding_id" integer NOT NULL, CONSTRAINT "PK_f0b14dc8a4cfd64381c399dc8f1" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "ifc"."notification_configs" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "school_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "trigger_type_id" integer NOT NULL, "ifc_status_type_id" integer NOT NULL, "title" jsonb NOT NULL DEFAULT '{}'::jsonb, "body" jsonb NOT NULL DEFAULT '{}'::jsonb, "to_chart_level_type_ids" jsonb NOT NULL DEFAULT '[]'::jsonb, "cc_chart_level_type_ids" jsonb NOT NULL DEFAULT '[]'::jsonb, CONSTRAINT "PK_25e7784b69fbdb82b911ca6aa88" PRIMARY KEY ("id"), CONSTRAINT "UQ_4689ce4c54254910a1e7ab56b1c" UNIQUE ("school_id", "academic_period_id", "trigger_type_id", "ifc_status_type_id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "ifc"."notification_log" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "ifc_id" integer NULL, "chart_id" integer NOT NULL, "notification_config_id" integer NOT NULL, "notifier_user_id" integer NULL, "to_staff_ids" jsonb NOT NULL DEFAULT '[]'::jsonb, "cc_staff_ids" jsonb NOT NULL DEFAULT '[]'::jsonb, "provider_message_id" varchar(500) NULL, CONSTRAINT "PK_6629ee1c2c51bb27669a0f9f428" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."enrolled_students" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "student_id" integer NOT NULL, "study_plan_academic_period" integer NOT NULL, "campus_id" integer NOT NULL, "enrollement_modality_type_id" integer NOT NULL, CONSTRAINT "PK_88157a8406d1bbca75ccac829d1" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."student_section_enrollments" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "enrolled_student_id" integer NOT NULL, "course_section_id" integer NOT NULL, CONSTRAINT "PK_3008b2b333530850fa1cc76fcd8" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evidence"."student_course_outcome_grades" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "student_section_enrollment_id" integer NOT NULL, "outcome_id" integer NOT NULL, "grade" numeric(12,6) NOT NULL, CONSTRAINT "PK_db1b3337f3dc55d018e04f328c7" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."projects" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "UQ_d95a87318392465ab663a32cc4f" UNIQUE ("code"), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."project_evaluators" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "project_id" integer NOT NULL, "professor_id" integer NOT NULL, "evaluator_type_id" integer NOT NULL, CONSTRAINT "PK_bda50204a8f0b447938f9de058c" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."project_students" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "project_id" integer NOT NULL, "student_section_enrollment_id" integer NOT NULL, CONSTRAINT "PK_4c91cdbc4130ba8bba12d23a28c" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evidence"."evaluations" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "project_student_id" integer NOT NULL, "project_evaluator_id" integer NOT NULL, "qualification_status_type_id" integer NOT NULL, "observation" jsonb DEFAULT '{}'::jsonb, "register_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "PK_f683b433eba0e6dae7e19b29e29" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."rubrics" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "rubric_type_id" integer NOT NULL, "grade_type_id" integer NOT NULL, "study_plan_course_id" integer NOT NULL, CONSTRAINT "PK_3dfcdc7f63f3fa048ebe0293a90" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."rubric_question_criterias" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "rubric_question_id" integer NOT NULL, "criteria" jsonb NOT NULL DEFAULT '{}'::jsonb, "min_value" numeric(12,6) NOT NULL, "max_value" numeric(12,6) NOT NULL, CONSTRAINT "PK_104ee798bfc899e19859348ea08" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."rubric_scores" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "evaluation_id" integer NOT NULL, "rubric_question_criteria_id" integer NOT NULL, "score" numeric(12,6) NOT NULL, "commentaries" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "PK_35eb0094940cd089113bae42d34" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "evaluation"."rubric_questions" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "rubric_id" integer NOT NULL, "outcome_id" integer NOT NULL, "question" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_7b046d188d390f1ff98f0031707" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "core"."type_groups" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "UQ_2e70b216ddac5c1ce8eb9410122" UNIQUE ("code"), CONSTRAINT "PK_73650a04200c679d5b25227ea5f" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "core"."types" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "type_group_id" integer NOT NULL, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "UQ_0888743b52d75e0435c1da667d0" UNIQUE ("code"), CONSTRAINT "PK_33b81de5358589c738907c3559b" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "core"."parameters" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "description" jsonb DEFAULT '{}'::jsonb, "value" jsonb DEFAULT '{}'::jsonb, CONSTRAINT "UQ_f9bdd410abefd57f573ec1bf9ec" UNIQUE ("code"), CONSTRAINT "PK_6b03a26baa3161f87fa87588859" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."student_course_grades" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "student_section_enrollment_id" integer NOT NULL, "grade_type_id" integer NOT NULL, "grade_type_percentage" numeric(12,6) NOT NULL, "grade" numeric(12,6) NOT NULL, CONSTRAINT "PK_1c08f5f803cdc9b99494f342b9a" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."performance_levels" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "instrument_type_id" integer NOT NULL, "academic_period_id" integer NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "code" character varying(50) NOT NULL, "unique_value" numeric(12,6) NOT NULL, "min_score" numeric(12,6) NOT NULL, "max_score" numeric(12,6) NOT NULL, "max_value" numeric(12,6) NOT NULL, CONSTRAINT "UQ_fef6f661903631fdbcea7b26d87" UNIQUE ("code"), CONSTRAINT "PK_ab12d65d08c56d9443953093a71" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "academic"."course_outcome_mappings" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "outcome_id" integer NOT NULL, "study_plan_course_id" integer NOT NULL, "outcome_type_id" integer NOT NULL, CONSTRAINT "PK_da935d2cca6b077a7be88e52cd1" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."commissions" ADD CONSTRAINT "FK_abde2f6c7c2c15d86d1ad18ff51" FOREIGN KEY ("accreditor_id") REFERENCES "accreditation"."accreditors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."program_commissions" ADD CONSTRAINT "FK_511d4b62c287b78c4af8f40316f" FOREIGN KEY ("commission_id") REFERENCES "accreditation"."commissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."program_commissions" ADD CONSTRAINT "FK_c9db3e661bf32fdb6e6ef308855" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."program_commissions" ADD CONSTRAINT "FK_a177876dc3e2ceca34941a843af" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "accreditation"."outcomes" ADD CONSTRAINT "FK_097598f7aa4d58807224829c9e3" FOREIGN KEY ("program_commission_id") REFERENCES "accreditation"."program_commissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."staff" ADD CONSTRAINT "FK_cec9365d9fc3a3409158b645f2e" FOREIGN KEY ("user_id") REFERENCES "organization"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."professors" ADD CONSTRAINT "FK_85d939ce84e33b8c05e5ab5c6b7" FOREIGN KEY ("staff_id") REFERENCES "organization"."staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plans" ADD CONSTRAINT "FK_b6f8c14929dad8515c26f0e99ca" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_academic_periods" ADD CONSTRAINT "FK_8be7ba65daa2348105b750d911f" FOREIGN KEY ("study_plan_id") REFERENCES "academic"."study_plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_academic_periods" ADD CONSTRAINT "FK_86bdb6267d08ac016e1217dfd28" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_courses" ADD CONSTRAINT "FK_5684f9badf760b33d503896ff7f" FOREIGN KEY ("study_plan_academic_period_id") REFERENCES "academic"."study_plan_academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_courses" ADD CONSTRAINT "FK_ca51537ec992562128c681f31ca" FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" ADD CONSTRAINT "FK_9e808a12c6fcda1f271e0b8e194" FOREIGN KEY ("study_plan_course_id") REFERENCES "academic"."study_plan_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" ADD CONSTRAINT "FK_08af529c306b942a0eb284bbb17" FOREIGN KEY ("campus_id") REFERENCES "organization"."campuses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_sections" ADD CONSTRAINT "FK_e23836d20c9e7c447ffa727292a" FOREIGN KEY ("professor_id") REFERENCES "academic"."professors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" ADD CONSTRAINT "FK_fb3eff90b11bddf7285f9b4e281" FOREIGN KEY ("user_id") REFERENCES "organization"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" ADD CONSTRAINT "FK_2a7ac955ea573f8be71d736cef8" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ADD CONSTRAINT "FK_1e2e74b43d94a79367b61e4eab1" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ADD CONSTRAINT "FK_8b4a1983abc06fdd685fec02cf1" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ADD CONSTRAINT "FK_7c0654dddcd08cb7dcbbb460558" FOREIGN KEY ("campus_id") REFERENCES "organization"."campuses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ADD CONSTRAINT "FK_1911b4f441dc5a55522d91fc5a9" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."surveys" ADD CONSTRAINT "FK_ff6454c0b5a61cbc19540cf87d2" FOREIGN KEY ("course_section_id") REFERENCES "academic"."course_sections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."scores" ADD CONSTRAINT "FK_f9c51419385591b860fe3153b3b" FOREIGN KEY ("survey_id") REFERENCES "evidence"."surveys"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."scores" ADD CONSTRAINT "FK_e360c3ba135fd978fdbe8391033" FOREIGN KEY ("outcome_id") REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."outcome_configs" ADD CONSTRAINT "FK_5bb175dcc2d9ef833fc7790604b" FOREIGN KEY ("outcome_id") REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."notifications" ADD CONSTRAINT "FK_b8613819b0c854f82e9578bb13b" FOREIGN KEY ("survey_id") REFERENCES "evidence"."surveys"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."notification_messages" ADD CONSTRAINT "FK_04df17b688b6db08ccb0e0a1cf5" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."schools" ADD CONSTRAINT "FK_fd58337f0f869a8b883f6fab518" FOREIGN KEY ("faculty_id") REFERENCES "organization"."faculties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."charts" ADD CONSTRAINT "FK_263811162a1ce42c386bf651451" FOREIGN KEY ("staff_id") REFERENCES "organization"."staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."charts" ADD CONSTRAINT "FK_ed6f544d34bc05b62407c971753" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."charts" ADD CONSTRAINT "FK_19cd031fd090d85727123449f03" FOREIGN KEY ("chart_level_id") REFERENCES "organization"."chart_levels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."plans" ADD CONSTRAINT "FK_7c9285fc09f3e86c715e210808e" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."plans" ADD CONSTRAINT "FK_72f85c54d1c16ba598f9bc5bdc0" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."actions" ADD CONSTRAINT "FK_2325b483c937fa28616029ba0f1" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."actions" ADD CONSTRAINT "FK_97c368289c2688d42c338d21823" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" ADD CONSTRAINT "FK_a28bcdfbddcadeb4087822d1a72" FOREIGN KEY ("instrument_id") REFERENCES "evidence"."instruments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" ADD CONSTRAINT "FK_7074bb1ffc321ab035336440293" FOREIGN KEY ("staff_id") REFERENCES "organization"."staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" ADD CONSTRAINT "FK_8bb159a3fedc577c1c8feb6d14a" FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" ADD CONSTRAINT "FK_82d0e6077d884da30557fc19c88" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."findings" ADD CONSTRAINT "FK_a6a196107377ba69657bdfd8163" FOREIGN KEY ("campus_id") REFERENCES "organization"."campuses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."finding_actions" ADD CONSTRAINT "FK_e4eb336fa30dc3f416f55468402" FOREIGN KEY ("finding_id") REFERENCES "improvement"."findings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."finding_actions" ADD CONSTRAINT "FK_a2a1769dd904b2a3f0dd1544370" FOREIGN KEY ("action_id") REFERENCES "improvement"."actions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."plan_actions" ADD CONSTRAINT "FK_8cc0b96651ab5867e0e83ec442e" FOREIGN KEY ("plan_id") REFERENCES "improvement"."plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."plan_actions" ADD CONSTRAINT "FK_9cf0aecd2f7635e698f7567b641" FOREIGN KEY ("finding_action_id") REFERENCES "improvement"."finding_actions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."finding_outcomes" ADD CONSTRAINT "FK_5eb171ec32f4884e90b47deec5b" FOREIGN KEY ("finding_id") REFERENCES "improvement"."findings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "improvement"."finding_outcomes" ADD CONSTRAINT "FK_2701838bd914e1c89012710be40" FOREIGN KEY ("outcome_id") REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ifcs" ADD CONSTRAINT "FK_ed6e1bb0dd8c28adcb279ef94d5" FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."ifcs" ADD CONSTRAINT "FK_ec1fc4fb915c886b871cd5d492b" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."statuses" ADD CONSTRAINT "FK_b880e46ee378768a6f4a032cb86" FOREIGN KEY ("ifc_id") REFERENCES "evidence"."ifcs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."statuses" ADD CONSTRAINT "FK_f8b5dfa2dcb03df1b77c30bdaed" FOREIGN KEY ("staff_id") REFERENCES "organization"."staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."ifc_findings" ADD CONSTRAINT "FK_fa2257fa21d62f5823789902cd1" FOREIGN KEY ("ifc_id") REFERENCES "evidence"."ifcs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."ifc_findings" ADD CONSTRAINT "FK_11936d3138eaa3ebb84540830f4" FOREIGN KEY ("finding_id") REFERENCES "improvement"."findings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD CONSTRAINT "FK_f713067637a7fae926e12670297" FOREIGN KEY ("school_id") REFERENCES "organization"."schools"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD CONSTRAINT "FK_235074c210b929308c3ee4b8ec6" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD CONSTRAINT "FK_25e766780a4dab387ec7797b144" FOREIGN KEY ("trigger_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD CONSTRAINT "FK_47f96cc66aa222368281dbb4f8c" FOREIGN KEY ("ifc_status_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "organization"."users" ADD CONSTRAINT "FK_9e86f4e5144e5f0c754ec343bea" FOREIGN KEY ("document_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_log" ADD CONSTRAINT "FK_52a53f8905f57e18b942bc0aa91" FOREIGN KEY ("ifc_id") REFERENCES "evidence"."ifcs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_log" ADD CONSTRAINT "FK_a629bdf7af991a09332156cf090" FOREIGN KEY ("chart_id") REFERENCES "organization"."charts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_log" ADD CONSTRAINT "FK_9f050e51dcc8c94037242889065" FOREIGN KEY ("notification_config_id") REFERENCES "ifc"."notification_configs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_log" ADD CONSTRAINT "FK_8a2b5e2c7c1f4a3e9d6b0c1a8f2" FOREIGN KEY ("notifier_user_id") REFERENCES "organization"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" ADD CONSTRAINT "FK_12ff6a3275ca209d440644c1eed" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" ADD CONSTRAINT "FK_c805f90e056db372ebdfb6423b6" FOREIGN KEY ("campus_id") REFERENCES "organization"."campuses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_section_enrollments" ADD CONSTRAINT "FK_3f9b6366ae909fd085358b64803" FOREIGN KEY ("enrolled_student_id") REFERENCES "academic"."enrolled_students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_section_enrollments" ADD CONSTRAINT "FK_f1979a38b2fc4be66a62f06de19" FOREIGN KEY ("course_section_id") REFERENCES "academic"."course_sections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."student_course_outcome_grades" ADD CONSTRAINT "FK_1956ae5a1d423350e1a0b7ca2d6" FOREIGN KEY ("student_section_enrollment_id") REFERENCES "academic"."student_section_enrollments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."student_course_outcome_grades" ADD CONSTRAINT "FK_74f59f74bf46c6224fcc44e8315" FOREIGN KEY ("outcome_id") REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" ADD CONSTRAINT "FK_6e239cee87fbc8145c259a57afe" FOREIGN KEY ("project_id") REFERENCES "evaluation"."projects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" ADD CONSTRAINT "FK_bc50693334616aaea73fa04acb9" FOREIGN KEY ("professor_id") REFERENCES "academic"."professors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_students" ADD CONSTRAINT "FK_03fe9c891618b667a122233f067" FOREIGN KEY ("project_id") REFERENCES "evaluation"."projects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_students" ADD CONSTRAINT "FK_c3ecb1a05e9f7f41142457de284" FOREIGN KEY ("student_section_enrollment_id") REFERENCES "academic"."student_section_enrollments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" ADD CONSTRAINT "FK_d8115d6a5ea8c9170bfd417f525" FOREIGN KEY ("project_student_id") REFERENCES "evaluation"."project_students"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" ADD CONSTRAINT "FK_e83ae3bbb89a4a8140408cc5ee4" FOREIGN KEY ("project_evaluator_id") REFERENCES "evaluation"."project_evaluators"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubrics" ADD CONSTRAINT "FK_8e2f1c4d5a6b7e8f9a0b1c2d3e4" FOREIGN KEY ("rubric_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubrics" ADD CONSTRAINT "FK_9f3a2b5c6d7e8f9a0b1c2d3e4f5" FOREIGN KEY ("grade_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubrics" ADD CONSTRAINT "FK_f23cab684bfd6263435e05121c4" FOREIGN KEY ("study_plan_course_id") REFERENCES "academic"."study_plan_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_scores" ADD CONSTRAINT "FK_6b7a0e963995aac32b706b65b1e" FOREIGN KEY ("evaluation_id") REFERENCES "evidence"."evaluations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_scores" ADD CONSTRAINT "FK_0f54742a01d56561986c77b0aa2" FOREIGN KEY ("rubric_question_criteria_id") REFERENCES "evaluation"."rubric_question_criterias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_questions" ADD CONSTRAINT "FK_60b889a63baa36375f264f812d9" FOREIGN KEY ("rubric_id") REFERENCES "evaluation"."rubrics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_questions" ADD CONSTRAINT "FK_828d98255d254f812a0d6732fb9" FOREIGN KEY ("outcome_id") REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."types" ADD CONSTRAINT "FK_d1bfd236db1805a762aa30de369" FOREIGN KEY ("type_group_id") REFERENCES "core"."type_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."student_course_grades" ADD CONSTRAINT "FK_8a14c3786b1412d4b11ebf144e7" FOREIGN KEY ("student_section_enrollment_id") REFERENCES "academic"."student_section_enrollments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."performance_levels" ADD CONSTRAINT "FK_d525cfd1a21b9e0488ef04cd09a" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_outcome_mappings" ADD CONSTRAINT "FK_a968164f8aa1859576af56971c2" FOREIGN KEY ("outcome_id") REFERENCES "accreditation"."outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."course_outcome_mappings" ADD CONSTRAINT "FK_11ba9460ef5a797504d1ab63b9a" FOREIGN KEY ("study_plan_course_id") REFERENCES "academic"."study_plan_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "academic"."course_outcome_mappings" DROP CONSTRAINT "FK_11ba9460ef5a797504d1ab63b9a"`);
		await queryRunner.query(`ALTER TABLE "academic"."course_outcome_mappings" DROP CONSTRAINT "FK_a968164f8aa1859576af56971c2"`);
		await queryRunner.query(`ALTER TABLE "academic"."performance_levels" DROP CONSTRAINT "FK_d525cfd1a21b9e0488ef04cd09a"`);
		await queryRunner.query(`ALTER TABLE "academic"."student_course_grades" DROP CONSTRAINT "FK_8a14c3786b1412d4b11ebf144e7"`);
		await queryRunner.query(`ALTER TABLE "core"."types" DROP CONSTRAINT "FK_d1bfd236db1805a762aa30de369"`);
		await queryRunner.query(`ALTER TABLE "evaluation"."rubric_questions" DROP CONSTRAINT "FK_828d98255d254f812a0d6732fb9"`);
		await queryRunner.query(`ALTER TABLE "evaluation"."rubric_questions" DROP CONSTRAINT "FK_60b889a63baa36375f264f812d9"`);
		await queryRunner.query(`ALTER TABLE "evaluation"."rubric_scores" DROP CONSTRAINT "FK_0f54742a01d56561986c77b0aa2"`);
		await queryRunner.query(`ALTER TABLE "evaluation"."rubric_scores" DROP CONSTRAINT "FK_6b7a0e963995aac32b706b65b1e"`);
		await queryRunner.query(`ALTER TABLE "evaluation"."rubrics" DROP CONSTRAINT "FK_f23cab684bfd6263435e05121c4"`);
		await queryRunner.query(`ALTER TABLE "evaluation"."rubrics" DROP CONSTRAINT "FK_9f3a2b5c6d7e8f9a0b1c2d3e4f5"`);
		await queryRunner.query(`ALTER TABLE "evaluation"."rubrics" DROP CONSTRAINT "FK_8e2f1c4d5a6b7e8f9a0b1c2d3e4"`);
		await queryRunner.query(`ALTER TABLE "evidence"."evaluations" DROP CONSTRAINT "FK_e83ae3bbb89a4a8140408cc5ee4"`);
		await queryRunner.query(`ALTER TABLE "evidence"."evaluations" DROP CONSTRAINT "FK_d8115d6a5ea8c9170bfd417f525"`);
		await queryRunner.query(`ALTER TABLE "evaluation"."project_students" DROP CONSTRAINT "FK_c3ecb1a05e9f7f41142457de284"`);
		await queryRunner.query(`ALTER TABLE "evaluation"."project_students" DROP CONSTRAINT "FK_03fe9c891618b667a122233f067"`);
		await queryRunner.query(`ALTER TABLE "evaluation"."project_evaluators" DROP CONSTRAINT "FK_bc50693334616aaea73fa04acb9"`);
		await queryRunner.query(`ALTER TABLE "evaluation"."project_evaluators" DROP CONSTRAINT "FK_6e239cee87fbc8145c259a57afe"`);
		await queryRunner.query(`ALTER TABLE "evidence"."student_course_outcome_grades" DROP CONSTRAINT "FK_74f59f74bf46c6224fcc44e8315"`);
		await queryRunner.query(`ALTER TABLE "evidence"."student_course_outcome_grades" DROP CONSTRAINT "FK_1956ae5a1d423350e1a0b7ca2d6"`);
		await queryRunner.query(`ALTER TABLE "academic"."student_section_enrollments" DROP CONSTRAINT "FK_f1979a38b2fc4be66a62f06de19"`);
		await queryRunner.query(`ALTER TABLE "academic"."student_section_enrollments" DROP CONSTRAINT "FK_3f9b6366ae909fd085358b64803"`);
		await queryRunner.query(`ALTER TABLE "academic"."enrolled_students" DROP CONSTRAINT "FK_c805f90e056db372ebdfb6423b6"`);
		await queryRunner.query(`ALTER TABLE "academic"."enrolled_students" DROP CONSTRAINT "FK_12ff6a3275ca209d440644c1eed"`);
		await queryRunner.query(`ALTER TABLE "ifc"."notification_log" DROP CONSTRAINT "FK_8a2b5e2c7c1f4a3e9d6b0c1a8f2"`);
		await queryRunner.query(`ALTER TABLE "ifc"."notification_log" DROP CONSTRAINT "FK_9f050e51dcc8c94037242889065"`);
		await queryRunner.query(`ALTER TABLE "ifc"."notification_log" DROP CONSTRAINT "FK_a629bdf7af991a09332156cf090"`);
		await queryRunner.query(`ALTER TABLE "ifc"."notification_log" DROP CONSTRAINT "FK_52a53f8905f57e18b942bc0aa91"`);
		await queryRunner.query(`ALTER TABLE "organization"."users" DROP CONSTRAINT "FK_9e86f4e5144e5f0c754ec343bea"`);
		await queryRunner.query(`ALTER TABLE "ifc"."notification_configs" DROP CONSTRAINT "FK_47f96cc66aa222368281dbb4f8c"`);
		await queryRunner.query(`ALTER TABLE "ifc"."notification_configs" DROP CONSTRAINT "FK_25e766780a4dab387ec7797b144"`);
		await queryRunner.query(`ALTER TABLE "ifc"."notification_configs" DROP CONSTRAINT "FK_235074c210b929308c3ee4b8ec6"`);
		await queryRunner.query(`ALTER TABLE "ifc"."notification_configs" DROP CONSTRAINT "FK_f713067637a7fae926e12670297"`);
		await queryRunner.query(`ALTER TABLE "ifc"."ifc_findings" DROP CONSTRAINT "FK_11936d3138eaa3ebb84540830f4"`);
		await queryRunner.query(`ALTER TABLE "ifc"."ifc_findings" DROP CONSTRAINT "FK_fa2257fa21d62f5823789902cd1"`);
		await queryRunner.query(`ALTER TABLE "ifc"."statuses" DROP CONSTRAINT "FK_f8b5dfa2dcb03df1b77c30bdaed"`);
		await queryRunner.query(`ALTER TABLE "ifc"."statuses" DROP CONSTRAINT "FK_b880e46ee378768a6f4a032cb86"`);
		await queryRunner.query(`ALTER TABLE "evidence"."ifcs" DROP CONSTRAINT "FK_ec1fc4fb915c886b871cd5d492b"`);
		await queryRunner.query(`ALTER TABLE "evidence"."ifcs" DROP CONSTRAINT "FK_ed6e1bb0dd8c28adcb279ef94d5"`);
		await queryRunner.query(`ALTER TABLE "improvement"."finding_outcomes" DROP CONSTRAINT "FK_2701838bd914e1c89012710be40"`);
		await queryRunner.query(`ALTER TABLE "improvement"."finding_outcomes" DROP CONSTRAINT "FK_5eb171ec32f4884e90b47deec5b"`);
		await queryRunner.query(`ALTER TABLE "improvement"."plan_actions" DROP CONSTRAINT "FK_9cf0aecd2f7635e698f7567b641"`);
		await queryRunner.query(`ALTER TABLE "improvement"."plan_actions" DROP CONSTRAINT "FK_8cc0b96651ab5867e0e83ec442e"`);
		await queryRunner.query(`ALTER TABLE "improvement"."finding_actions" DROP CONSTRAINT "FK_a2a1769dd904b2a3f0dd1544370"`);
		await queryRunner.query(`ALTER TABLE "improvement"."finding_actions" DROP CONSTRAINT "FK_e4eb336fa30dc3f416f55468402"`);
		await queryRunner.query(`ALTER TABLE "improvement"."findings" DROP CONSTRAINT "FK_a6a196107377ba69657bdfd8163"`);
		await queryRunner.query(`ALTER TABLE "improvement"."findings" DROP CONSTRAINT "FK_82d0e6077d884da30557fc19c88"`);
		await queryRunner.query(`ALTER TABLE "improvement"."findings" DROP CONSTRAINT "FK_8bb159a3fedc577c1c8feb6d14a"`);
		await queryRunner.query(`ALTER TABLE "improvement"."findings" DROP CONSTRAINT "FK_7074bb1ffc321ab035336440293"`);
		await queryRunner.query(`ALTER TABLE "improvement"."findings" DROP CONSTRAINT "FK_a28bcdfbddcadeb4087822d1a72"`);
		await queryRunner.query(`ALTER TABLE "improvement"."actions" DROP CONSTRAINT "FK_97c368289c2688d42c338d21823"`);
		await queryRunner.query(`ALTER TABLE "improvement"."actions" DROP CONSTRAINT "FK_2325b483c937fa28616029ba0f1"`);
		await queryRunner.query(`ALTER TABLE "improvement"."plans" DROP CONSTRAINT "FK_72f85c54d1c16ba598f9bc5bdc0"`);
		await queryRunner.query(`ALTER TABLE "improvement"."plans" DROP CONSTRAINT "FK_7c9285fc09f3e86c715e210808e"`);
		await queryRunner.query(`ALTER TABLE "organization"."charts" DROP CONSTRAINT "FK_19cd031fd090d85727123449f03"`);
		await queryRunner.query(`ALTER TABLE "organization"."charts" DROP CONSTRAINT "FK_ed6f544d34bc05b62407c971753"`);
		await queryRunner.query(`ALTER TABLE "organization"."charts" DROP CONSTRAINT "FK_263811162a1ce42c386bf651451"`);
		await queryRunner.query(`ALTER TABLE "organization"."schools" DROP CONSTRAINT "FK_fd58337f0f869a8b883f6fab518"`);
		await queryRunner.query(`ALTER TABLE "survey"."notification_messages" DROP CONSTRAINT "FK_04df17b688b6db08ccb0e0a1cf5"`);
		await queryRunner.query(`ALTER TABLE "survey"."notifications" DROP CONSTRAINT "FK_b8613819b0c854f82e9578bb13b"`);
		await queryRunner.query(`ALTER TABLE "survey"."outcome_configs" DROP CONSTRAINT "FK_5bb175dcc2d9ef833fc7790604b"`);
		await queryRunner.query(`ALTER TABLE "survey"."scores" DROP CONSTRAINT "FK_e360c3ba135fd978fdbe8391033"`);
		await queryRunner.query(`ALTER TABLE "survey"."scores" DROP CONSTRAINT "FK_f9c51419385591b860fe3153b3b"`);
		await queryRunner.query(`ALTER TABLE "evidence"."surveys" DROP CONSTRAINT "FK_ff6454c0b5a61cbc19540cf87d2"`);
		await queryRunner.query(`ALTER TABLE "evidence"."surveys" DROP CONSTRAINT "FK_1911b4f441dc5a55522d91fc5a9"`);
		await queryRunner.query(`ALTER TABLE "evidence"."surveys" DROP CONSTRAINT "FK_7c0654dddcd08cb7dcbbb460558"`);
		await queryRunner.query(`ALTER TABLE "evidence"."surveys" DROP CONSTRAINT "FK_8b4a1983abc06fdd685fec02cf1"`);
		await queryRunner.query(`ALTER TABLE "evidence"."surveys" DROP CONSTRAINT "FK_1e2e74b43d94a79367b61e4eab1"`);
		await queryRunner.query(`ALTER TABLE "academic"."students" DROP CONSTRAINT "FK_2a7ac955ea573f8be71d736cef8"`);
		await queryRunner.query(`ALTER TABLE "academic"."students" DROP CONSTRAINT "FK_fb3eff90b11bddf7285f9b4e281"`);
		await queryRunner.query(`ALTER TABLE "academic"."course_sections" DROP CONSTRAINT "FK_e23836d20c9e7c447ffa727292a"`);
		await queryRunner.query(`ALTER TABLE "academic"."course_sections" DROP CONSTRAINT "FK_08af529c306b942a0eb284bbb17"`);
		await queryRunner.query(`ALTER TABLE "academic"."course_sections" DROP CONSTRAINT "FK_9e808a12c6fcda1f271e0b8e194"`);
		await queryRunner.query(`ALTER TABLE "academic"."study_plan_courses" DROP CONSTRAINT "FK_ca51537ec992562128c681f31ca"`);
		await queryRunner.query(`ALTER TABLE "academic"."study_plan_courses" DROP CONSTRAINT "FK_5684f9badf760b33d503896ff7f"`);
		await queryRunner.query(`ALTER TABLE "academic"."study_plan_academic_periods" DROP CONSTRAINT "FK_86bdb6267d08ac016e1217dfd28"`);
		await queryRunner.query(`ALTER TABLE "academic"."study_plan_academic_periods" DROP CONSTRAINT "FK_8be7ba65daa2348105b750d911f"`);
		await queryRunner.query(`ALTER TABLE "academic"."study_plans" DROP CONSTRAINT "FK_b6f8c14929dad8515c26f0e99ca"`);
		await queryRunner.query(`ALTER TABLE "academic"."professors" DROP CONSTRAINT "FK_85d939ce84e33b8c05e5ab5c6b7"`);
		await queryRunner.query(`ALTER TABLE "organization"."staff" DROP CONSTRAINT "FK_cec9365d9fc3a3409158b645f2e"`);
		await queryRunner.query(`ALTER TABLE "accreditation"."outcomes" DROP CONSTRAINT "FK_097598f7aa4d58807224829c9e3"`);
		await queryRunner.query(`ALTER TABLE "accreditation"."program_commissions" DROP CONSTRAINT "FK_a177876dc3e2ceca34941a843af"`);
		await queryRunner.query(`ALTER TABLE "accreditation"."program_commissions" DROP CONSTRAINT "FK_c9db3e661bf32fdb6e6ef308855"`);
		await queryRunner.query(`ALTER TABLE "accreditation"."program_commissions" DROP CONSTRAINT "FK_511d4b62c287b78c4af8f40316f"`);
		await queryRunner.query(`ALTER TABLE "accreditation"."commissions" DROP CONSTRAINT "FK_abde2f6c7c2c15d86d1ad18ff51"`);
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
		await queryRunner.query(`DROP TABLE "ifc"."notification_log"`);
		await queryRunner.query(`DROP TABLE "ifc"."notification_configs"`);
		await queryRunner.query(`DROP TABLE "ifc"."ifc_findings"`);
		await queryRunner.query(`DROP TABLE "ifc"."statuses"`);
		await queryRunner.query(`DROP TABLE "evidence"."ifcs"`);
		await queryRunner.query(`DROP TABLE "improvement"."finding_outcomes"`);
		await queryRunner.query(`DROP TABLE "improvement"."plan_actions"`);
		await queryRunner.query(`DROP TABLE "improvement"."finding_actions"`);
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
		await queryRunner.query(`DROP TABLE "academic"."academic_periods"`);
	}
}
