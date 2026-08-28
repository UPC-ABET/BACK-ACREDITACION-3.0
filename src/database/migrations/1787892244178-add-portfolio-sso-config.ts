import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPortfolioSsoConfig1787892244178 implements MigrationInterface {
	name = 'AddPortfolioSsoConfig1787892244178';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "core"."portfolio_sso_config" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"base_url" character varying(1000) NOT NULL,
				"api_key_encrypted" character varying(5000) NOT NULL,
				CONSTRAINT "PK_portfolio_sso_config" PRIMARY KEY ("id")
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."portfolio_sso_config"`);
	}
}
