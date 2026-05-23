import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetToUsers1748059200000 implements MigrationInterface {
	name = 'AddPasswordResetToUsers1748059200000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "organization"."users" ADD COLUMN IF NOT EXISTS "password_reset_token" varchar(1000) NULL`);
		await queryRunner.query(`ALTER TABLE "organization"."users" ADD COLUMN IF NOT EXISTS "password_reset_expires_at" varchar(100) NULL`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "organization"."users" DROP COLUMN IF EXISTS "password_reset_expires_at"`);
		await queryRunner.query(`ALTER TABLE "organization"."users" DROP COLUMN IF EXISTS "password_reset_token"`);
	}
}
