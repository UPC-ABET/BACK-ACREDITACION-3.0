import dataSource from '../typeorm.config';

async function run() {
	await dataSource.initialize();

	const tenants = [{ code: 'redsgo' }, { code: 'upc' }];
	for (const t of tenants) {
		console.log(`Migrating schema: ${t.code}`);

		await dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${t.code}`);
		await dataSource.query(`SET search_path TO ${t.code}`);

		await dataSource.runMigrations();
	}

	await dataSource.destroy();

	console.log('All tenant migrations completed.');
}

void run();
