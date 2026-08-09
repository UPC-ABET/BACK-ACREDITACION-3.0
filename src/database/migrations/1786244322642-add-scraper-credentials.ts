import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScraperCredentials1786244322642 implements MigrationInterface {
	name = 'AddScraperCredentials1786244322642';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "core"."scraper_credentials" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"provider_code" character varying(50) NOT NULL,
				"username" character varying(100) NOT NULL,
				"password_encrypted" character varying(5000) NOT NULL,
				CONSTRAINT "PK_scraper_credentials" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM pg_constraint WHERE conname = 'UQ_scraper_credentials_provider_code'
				) THEN
					ALTER TABLE "core"."scraper_credentials"
					ADD CONSTRAINT "UQ_scraper_credentials_provider_code" UNIQUE ("provider_code");
				END IF;
			END $$;
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE IF EXISTS "core"."scraper_credentials" DROP CONSTRAINT IF EXISTS "UQ_scraper_credentials_provider_code"`,
		);
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."scraper_credentials"`);
	}
}
