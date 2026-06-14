import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortfolioAccessConfig1781372552000 implements MigrationInterface {
	name = 'PortfolioAccessConfig1781372552000';

	public async up(queryRunner: QueryRunner): Promise<void> {
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

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_portfolio_access_config_user_id"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "portfolio"."access_config"`);
	}
}
