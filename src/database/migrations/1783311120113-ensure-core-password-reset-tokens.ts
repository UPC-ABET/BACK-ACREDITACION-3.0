import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureCorePasswordResetTokens1783311120113 implements MigrationInterface {
	name = 'EnsureCorePasswordResetTokens1783311120113';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DO $$
			BEGIN
				IF to_regclass('organization.password_reset_tokens') IS NOT NULL
					AND to_regclass('core.password_reset_tokens') IS NULL
				THEN
					ALTER TABLE "organization"."password_reset_tokens" SET SCHEMA "core";
				END IF;
			END $$;
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "core"."password_reset_tokens" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"user_id" integer NOT NULL,
				"token_hash" character varying(100) NOT NULL,
				"expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
				"used_at" TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM pg_constraint WHERE conname = 'UQ_password_reset_tokens_token_hash'
				) THEN
					ALTER TABLE "core"."password_reset_tokens"
					ADD CONSTRAINT "UQ_password_reset_tokens_token_hash" UNIQUE ("token_hash");
				END IF;
			END $$;
		`);

		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_password_reset_tokens_user_id" ON "core"."password_reset_tokens" ("user_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_password_reset_tokens_expires_at" ON "core"."password_reset_tokens" ("expires_at")`,
		);
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM pg_constraint WHERE conname = 'FK_password_reset_tokens_user_id'
				) THEN
					ALTER TABLE "core"."password_reset_tokens"
					ADD CONSTRAINT "FK_password_reset_tokens_user_id"
					FOREIGN KEY ("user_id") REFERENCES "organization"."users"("id")
					ON DELETE CASCADE ON UPDATE NO ACTION;
				END IF;
			END $$;
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE IF EXISTS "core"."password_reset_tokens" DROP CONSTRAINT IF EXISTS "FK_password_reset_tokens_user_id"`,
		);
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_password_reset_tokens_expires_at"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_password_reset_tokens_user_id"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."password_reset_tokens"`);
	}
}
