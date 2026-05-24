import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRolesAndPermissions1779580800000 implements MigrationInterface {
	name = 'AddRolesAndPermissions1779580800000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "roles" (
				"id" SERIAL PRIMARY KEY,
				"name" JSONB NOT NULL,
				"code" VARCHAR(50) NOT NULL UNIQUE,
				"description" TEXT,
				"is_active" BOOLEAN NOT NULL DEFAULT true,
				"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMPTZ
			)
		`);

		await this.alterOwnerToRootIfExists(queryRunner, 'roles');

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "user_roles" (
				"id" SERIAL PRIMARY KEY,
				"user_id" INTEGER NOT NULL,
				"role_id" INTEGER NOT NULL,
				"is_active" BOOLEAN NOT NULL DEFAULT true,
				"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMPTZ,
				CONSTRAINT "fk_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "organization"."users"("id"),
				CONSTRAINT "fk_user_roles_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id"),
				CONSTRAINT "uq_user_roles_user_role" UNIQUE ("user_id", "role_id")
			)
		`);

		await this.alterOwnerToRootIfExists(queryRunner, 'user_roles');

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "idx_user_roles_user_active"
			ON "user_roles" ("user_id", "is_active")
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "role_module_permissions" (
				"id" SERIAL PRIMARY KEY,
				"role_id" INTEGER NOT NULL,
				"module_type_id" INTEGER NOT NULL,
				"permission_type_id" INTEGER NOT NULL,
				"is_active" BOOLEAN NOT NULL DEFAULT true,
				"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMPTZ,
				CONSTRAINT "fk_rmp_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id"),
				CONSTRAINT "fk_rmp_module_type" FOREIGN KEY ("module_type_id") REFERENCES "core"."types"("id"),
				CONSTRAINT "fk_rmp_permission_type" FOREIGN KEY ("permission_type_id") REFERENCES "core"."types"("id"),
				CONSTRAINT "uq_role_module_permission" UNIQUE ("role_id", "module_type_id", "permission_type_id")
			)
		`);

		await this.alterOwnerToRootIfExists(queryRunner, 'role_module_permissions');

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "idx_role_module_permissions_lookup"
			ON "role_module_permissions" ("role_id", "module_type_id", "permission_type_id", "is_active")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "idx_role_module_permissions_lookup"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "role_module_permissions"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_roles_user_active"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "user_roles"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
	}

	private async alterOwnerToRootIfExists(queryRunner: QueryRunner, tableName: string): Promise<void> {
		await queryRunner.query(`
			DO $$
			BEGIN
				IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'root') THEN
					EXECUTE format('ALTER TABLE %I OWNER TO root', '${tableName}');
				END IF;
			END $$;
		`);
	}
}
