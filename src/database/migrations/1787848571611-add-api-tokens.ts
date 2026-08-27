import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApiTokens1787848571611 implements MigrationInterface {
	name = 'AddApiTokens1787848571611';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "core"."api_tokens" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"name" character varying(255) NOT NULL,
				"key_id" character varying(50) NOT NULL,
				"secret_hash" character varying(255) NOT NULL,
				"scopes" jsonb NOT NULL,
				"expires_at" TIMESTAMP WITH TIME ZONE,
				"created_by_user_id" integer NOT NULL,
				"revoked_by_user_id" integer,
				"revoked_at" TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "PK_api_tokens" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`
			ALTER TABLE "core"."api_tokens"
			ADD CONSTRAINT "UQ_api_tokens_key_id" UNIQUE ("key_id")
		`);

		await queryRunner.query(`
			ALTER TABLE "core"."api_tokens" ADD CONSTRAINT "FK_api_tokens_created_by_user"
			FOREIGN KEY ("created_by_user_id") REFERENCES "organization"."users"("id")
		`);

		await queryRunner.query(`
			ALTER TABLE "core"."api_tokens" ADD CONSTRAINT "FK_api_tokens_revoked_by_user"
			FOREIGN KEY ("revoked_by_user_id") REFERENCES "organization"."users"("id")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE IF EXISTS "core"."api_tokens" DROP CONSTRAINT IF EXISTS "FK_api_tokens_revoked_by_user"`,
		);
		await queryRunner.query(
			`ALTER TABLE IF EXISTS "core"."api_tokens" DROP CONSTRAINT IF EXISTS "FK_api_tokens_created_by_user"`,
		);
		await queryRunner.query(
			`ALTER TABLE IF EXISTS "core"."api_tokens" DROP CONSTRAINT IF EXISTS "UQ_api_tokens_key_id"`,
		);
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."api_tokens"`);
	}
}
