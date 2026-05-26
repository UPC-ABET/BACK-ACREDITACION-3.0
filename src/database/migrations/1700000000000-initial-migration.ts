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
		await queryRunner.query(
			`CREATE INDEX "IDX_academic_periods_year" ON "academic"."academic_periods" ("year")`,
		);
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
			`CREATE INDEX "IDX_findings_course_period" ON "improvement"."findings" ("course_id", "academic_period_id")`,
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
			`CREATE TABLE "ifc"."notification_logs" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "ifc_id" integer NULL, "chart_id" integer NOT NULL, "notification_config_id" integer NOT NULL, "notifier_user_id" integer NULL, "to_staff_ids" jsonb NOT NULL DEFAULT '[]'::jsonb, "cc_staff_ids" jsonb NOT NULL DEFAULT '[]'::jsonb, "provider_message_id" varchar(500) NULL, CONSTRAINT "PK_6629ee1c2c51bb27669a0f9f428" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_notification_logs_ifc_id" ON "ifc"."notification_logs" ("ifc_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_notification_logs_chart_id" ON "ifc"."notification_logs" ("chart_id")`,
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
			`CREATE TABLE "evaluation"."rubric_questions" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "rubric_id" integer NOT NULL, "outcome_id" integer, "question" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_7b046d188d390f1ff98f0031707" PRIMARY KEY ("id"))`,
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
		await queryRunner.query(`DROP INDEX "IDX_role_module_permissions_lookup"`);
		await queryRunner.query(`DROP TABLE "core"."role_module_permissions"`);
		await queryRunner.query(`DROP INDEX "IDX_user_roles_user_active"`);
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
		await queryRunner.query(`DROP TABLE "evidence"."ifcs"`);
		await queryRunner.query(`DROP TABLE "improvement"."finding_outcomes"`);
		await queryRunner.query(`DROP TABLE "improvement"."plan_actions"`);
		await queryRunner.query(`DROP TABLE "improvement"."finding_actions"`);
		await queryRunner.query(`DROP INDEX "IDX_findings_course_period"`);
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
