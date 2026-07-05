import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Adds the "grupo de proyecto" (empresa virtual) concept:
 *
 * 1. Creates evaluation.project_groups: a project group scoped to one academic period + program
 *    (career). The business key `code` is unique within (code, academic_period_id, program_id) —
 *    the same group re-registers per period/career, it is not a global master table.
 *
 * 2. Adds a nullable evaluation.projects.project_group_id FK so each academic project can belong to
 *    a project group. Nullable for backward compatibility with projects created before this feature;
 *    new projects created via the API/bulk-upload always set it.
 */
export class AddProjectGroups1783236955644 implements MigrationInterface {
	name = 'AddProjectGroups1783236955644';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ── 1. project_groups table ─────────────────────────────────────────
		await queryRunner.query(
			`CREATE TABLE "evaluation"."project_groups" (` +
				`"id" SERIAL NOT NULL, ` +
				`"extra" jsonb NOT NULL DEFAULT '{}'::jsonb, ` +
				`"is_active" boolean NOT NULL DEFAULT true, ` +
				`"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), ` +
				`"updated_at" TIMESTAMP WITH TIME ZONE, ` +
				`"code" character varying(50) NOT NULL, ` +
				`"name" jsonb NOT NULL DEFAULT '{}'::jsonb, ` +
				`"description" jsonb DEFAULT '{}'::jsonb, ` +
				`"academic_period_id" integer NOT NULL, ` +
				`"program_id" integer NOT NULL, ` +
				`CONSTRAINT "PK_project_groups" PRIMARY KEY ("id"))`,
		);

		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_project_groups_code_period_program" ` +
				`ON "evaluation"."project_groups" ("code", "academic_period_id", "program_id")`,
		);

		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" ADD CONSTRAINT "FK_project_groups_academic_period_id" ` +
				`FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ` +
				`ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" ADD CONSTRAINT "FK_project_groups_program_id" ` +
				`FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ` +
				`ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);

		// ── 2. projects.project_group_id ────────────────────────────────────
		await queryRunner.query(
			`ALTER TABLE "evaluation"."projects" ADD COLUMN "project_group_id" integer`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_projects_project_group_id" ON "evaluation"."projects" ("project_group_id")`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."projects" ADD CONSTRAINT "FK_projects_project_group_id" ` +
				`FOREIGN KEY ("project_group_id") REFERENCES "evaluation"."project_groups"("id") ` +
				`ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "evaluation"."projects" DROP CONSTRAINT IF EXISTS "FK_projects_project_group_id"`,
		);
		await queryRunner.query(`DROP INDEX IF EXISTS "evaluation"."IDX_projects_project_group_id"`);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."projects" DROP COLUMN IF EXISTS "project_group_id"`,
		);

		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" DROP CONSTRAINT IF EXISTS "FK_project_groups_program_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" DROP CONSTRAINT IF EXISTS "FK_project_groups_academic_period_id"`,
		);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "evaluation"."UQ_project_groups_code_period_program"`,
		);
		await queryRunner.query(`DROP TABLE IF EXISTS "evaluation"."project_groups"`);
	}
}
