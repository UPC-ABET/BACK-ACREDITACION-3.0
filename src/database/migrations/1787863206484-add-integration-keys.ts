import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntegrationKeys1787863206484 implements MigrationInterface {
	name = 'AddIntegrationKeys1787863206484';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "core"."integration_keys" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"api_token_id" integer NOT NULL,
				"key_encrypted" character varying(5000) NOT NULL,
				"issued_by_user_id" integer NOT NULL,
				CONSTRAINT "PK_integration_keys" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`
			ALTER TABLE "core"."integration_keys"
			ADD CONSTRAINT "UQ_integration_keys_api_token_id" UNIQUE ("api_token_id")
		`);

		await queryRunner.query(`
			ALTER TABLE "core"."integration_keys" ADD CONSTRAINT "FK_integration_keys_api_token_id"
			FOREIGN KEY ("api_token_id") REFERENCES "core"."api_tokens"("id")
		`);

		await queryRunner.query(`
			ALTER TABLE "core"."integration_keys" ADD CONSTRAINT "FK_integration_keys_issued_by_user"
			FOREIGN KEY ("issued_by_user_id") REFERENCES "organization"."users"("id")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE IF EXISTS "core"."integration_keys" DROP CONSTRAINT IF EXISTS "FK_integration_keys_issued_by_user"`,
		);
		await queryRunner.query(
			`ALTER TABLE IF EXISTS "core"."integration_keys" DROP CONSTRAINT IF EXISTS "FK_integration_keys_api_token_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE IF EXISTS "core"."integration_keys" DROP CONSTRAINT IF EXISTS "UQ_integration_keys_api_token_id"`,
		);
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."integration_keys"`);
	}
}
