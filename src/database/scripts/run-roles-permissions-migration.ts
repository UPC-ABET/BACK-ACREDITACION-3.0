import dataSource from '../typeorm.config';
import { AddRolesAndPermissions1779580800000 } from '../migrations/1779580800000-add-roles-and-permissions';

async function run() {
	const migration = new AddRolesAndPermissions1779580800000();
	const timestamp = 1779580800000;

	await dataSource.initialize();

	const queryRunner = dataSource.createQueryRunner();
	await queryRunner.connect();
	await queryRunner.startTransaction();

	try {
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "migrations" (
				"id" SERIAL PRIMARY KEY,
				"timestamp" BIGINT NOT NULL,
				"name" VARCHAR NOT NULL
			)
		`);

		const executed = await queryRunner.query(
			`SELECT 1 FROM "migrations" WHERE "timestamp" = $1 AND "name" = $2 LIMIT 1`,
			[timestamp, migration.name],
		);

		if (executed.length === 0) {
			await migration.up(queryRunner);
			await queryRunner.query(`INSERT INTO "migrations"("timestamp", "name") VALUES ($1, $2)`, [
				timestamp,
				migration.name,
			]);
		}

		await queryRunner.commitTransaction();
	} catch (error) {
		await queryRunner.rollbackTransaction();
		throw error;
	} finally {
		await queryRunner.release();
		await dataSource.destroy();
	}
}

void run();
