import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPortfolioSchema1782030180878 implements MigrationInterface {
	name = 'DropPortfolioSchema1782030180878';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP SCHEMA IF EXISTS "portfolio" CASCADE`);
	}

	// Recreates the portfolio schema as defined by AddPortfolioSchema1781042257318 and
	// PortfolioAccessConfig1781372552000, the two migrations whose effect this one reverses.
	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "portfolio"`);

		await queryRunner.query(`
			CREATE TABLE "portfolio"."companies" (
				"id"                 SERIAL              NOT NULL,
				"extra"              JSONB               NOT NULL DEFAULT '{}',
				"is_active"          BOOLEAN             NOT NULL DEFAULT true,
				"created_at"         TIMESTAMPTZ         NOT NULL DEFAULT CURRENT_TIMESTAMP,
				"updated_at"         TIMESTAMPTZ         DEFAULT CURRENT_TIMESTAMP,
				"name"               VARCHAR(255)        NOT NULL,
				"code"               VARCHAR(50)         NOT NULL,
				"is_from_upc"        BOOLEAN             NOT NULL DEFAULT false,
				"academic_period_id" INTEGER             NOT NULL,
				"modality_type_id"   INTEGER             NOT NULL,
				CONSTRAINT "PK_portfolio_companies" PRIMARY KEY ("id"),
				CONSTRAINT "FK_portfolio_companies_academic_period_id"
					FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id"),
				CONSTRAINT "FK_portfolio_companies_modality_type_id"
					FOREIGN KEY ("modality_type_id") REFERENCES "core"."types"("id")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_portfolio_companies_academic_period_id" ON "portfolio"."companies" ("academic_period_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_portfolio_companies_modality_type_id" ON "portfolio"."companies" ("modality_type_id")`,
		);

		await queryRunner.query(`
			CREATE TABLE "portfolio"."research_lines" (
				"id"               SERIAL       NOT NULL,
				"extra"            JSONB        NOT NULL DEFAULT '{}',
				"is_active"        BOOLEAN      NOT NULL DEFAULT true,
				"created_at"       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
				"updated_at"       TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
				"name"             VARCHAR(255) NOT NULL,
				"program_id"       INTEGER      NOT NULL,
				"modality_type_id" INTEGER      NOT NULL,
				CONSTRAINT "PK_portfolio_research_lines" PRIMARY KEY ("id"),
				CONSTRAINT "FK_portfolio_research_lines_program_id"
					FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id"),
				CONSTRAINT "FK_portfolio_research_lines_modality_type_id"
					FOREIGN KEY ("modality_type_id") REFERENCES "core"."types"("id")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_portfolio_research_lines_program_id" ON "portfolio"."research_lines" ("program_id")`,
		);

		await queryRunner.query(`
			CREATE TABLE "portfolio"."projects" (
				"id"                           SERIAL        NOT NULL,
				"extra"                        JSONB         NOT NULL DEFAULT '{}',
				"is_active"                    BOOLEAN       NOT NULL DEFAULT true,
				"created_at"                   TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
				"updated_at"                   TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
				"code"                         VARCHAR(50)   NOT NULL,
				"name"                         VARCHAR(255)  NOT NULL,
				"description"                  VARCHAR(5000),
				"problem_solved"               VARCHAR(5000),
				"goal"                         VARCHAR(5000),
				"is_from_upc"                  BOOLEAN       NOT NULL DEFAULT false,
				"status"                       INTEGER       NOT NULL DEFAULT 2,
				"student_one_id"               INTEGER,
				"student_two_id"               INTEGER,
				"academic_period_id"           INTEGER       NOT NULL,
				"modality_type_id"             INTEGER       NOT NULL,
				"company_id"                   INTEGER       NOT NULL,
				"course_section_id"            INTEGER,
				"research_line_id"             INTEGER,
				"program_id"                   INTEGER       NOT NULL,
				"coauthor_professor_id"        INTEGER,
				"consultant_professor_id"      INTEGER,
				"student_one_enrollment_id"    INTEGER,
				"student_two_enrollment_id"    INTEGER,
				CONSTRAINT "PK_portfolio_projects" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_portfolio_projects_code" UNIQUE ("code"),
				CONSTRAINT "FK_portfolio_projects_student_one_id"
					FOREIGN KEY ("student_one_id") REFERENCES "academic"."students"("id"),
				CONSTRAINT "FK_portfolio_projects_student_two_id"
					FOREIGN KEY ("student_two_id") REFERENCES "academic"."students"("id"),
				CONSTRAINT "FK_portfolio_projects_academic_period_id"
					FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id"),
				CONSTRAINT "FK_portfolio_projects_modality_type_id"
					FOREIGN KEY ("modality_type_id") REFERENCES "core"."types"("id"),
				CONSTRAINT "FK_portfolio_projects_company_id"
					FOREIGN KEY ("company_id") REFERENCES "portfolio"."companies"("id"),
				CONSTRAINT "FK_portfolio_projects_course_section_id"
					FOREIGN KEY ("course_section_id") REFERENCES "academic"."course_sections"("id"),
				CONSTRAINT "FK_portfolio_projects_research_line_id"
					FOREIGN KEY ("research_line_id") REFERENCES "portfolio"."research_lines"("id"),
				CONSTRAINT "FK_portfolio_projects_program_id"
					FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id"),
				CONSTRAINT "FK_portfolio_projects_coauthor_professor_id"
					FOREIGN KEY ("coauthor_professor_id") REFERENCES "academic"."professors"("id"),
				CONSTRAINT "FK_portfolio_projects_consultant_professor_id"
					FOREIGN KEY ("consultant_professor_id") REFERENCES "academic"."professors"("id"),
				CONSTRAINT "FK_portfolio_projects_student_one_enrollment_id"
					FOREIGN KEY ("student_one_enrollment_id") REFERENCES "academic"."student_section_enrollments"("id"),
				CONSTRAINT "FK_portfolio_projects_student_two_enrollment_id"
					FOREIGN KEY ("student_two_enrollment_id") REFERENCES "academic"."student_section_enrollments"("id")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_portfolio_projects_academic_period_id" ON "portfolio"."projects" ("academic_period_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_portfolio_projects_program_id" ON "portfolio"."projects" ("program_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_portfolio_projects_modality_type_id" ON "portfolio"."projects" ("modality_type_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_portfolio_projects_status" ON "portfolio"."projects" ("status")`,
		);

		await queryRunner.query(`
			CREATE TABLE "portfolio"."project_applications" (
				"id"         SERIAL       NOT NULL,
				"extra"      JSONB        NOT NULL DEFAULT '{}',
				"is_active"  BOOLEAN      NOT NULL DEFAULT true,
				"created_at" TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
				"updated_at" TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
				"project_id" INTEGER      NOT NULL,
				"student_id" INTEGER      NOT NULL,
				"status"     VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
				CONSTRAINT "PK_portfolio_project_applications" PRIMARY KEY ("id"),
				CONSTRAINT "FK_portfolio_project_applications_project_id"
					FOREIGN KEY ("project_id") REFERENCES "portfolio"."projects"("id") ON DELETE CASCADE,
				CONSTRAINT "FK_portfolio_project_applications_student_id"
					FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_portfolio_project_applications_project_id" ON "portfolio"."project_applications" ("project_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_portfolio_project_applications_student_id" ON "portfolio"."project_applications" ("student_id")`,
		);

		await queryRunner.query(`
			CREATE TABLE "portfolio"."access_config" (
				"id"                 SERIAL          NOT NULL,
				"extra"              JSONB           NOT NULL DEFAULT '{}',
				"is_active"          BOOLEAN         NOT NULL DEFAULT true,
				"created_at"         TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
				"updated_at"         TIMESTAMPTZ     DEFAULT CURRENT_TIMESTAMP,
				"user_id"            INTEGER         NOT NULL,
				"full_access"        BOOLEAN         NOT NULL DEFAULT false,
				"allowed_prefixes"   JSONB           NOT NULL DEFAULT '[]',
				CONSTRAINT "PK_portfolio_access_config" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_portfolio_access_config_user_id" UNIQUE ("user_id"),
				CONSTRAINT "FK_portfolio_access_config_user_id"
					FOREIGN KEY ("user_id") REFERENCES "organization"."users"("id") ON DELETE CASCADE
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_portfolio_access_config_user_id" ON "portfolio"."access_config" ("user_id")`,
		);
	}
}
