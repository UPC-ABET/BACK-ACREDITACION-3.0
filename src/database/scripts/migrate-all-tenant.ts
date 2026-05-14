import dataSource from '../typeorm.config';

async function run() {
	await dataSource.initialize();

	// Tabla global en public
	//const tenants = await dataSource.query(`SELECT code FROM public.companies`);

	const tenants = [{ code: 'redsgo' }, { code: 'upc' }];
	for (const t of tenants) {
		console.log(`Migrando schema: ${t.code}`);

		await dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${t.code}`);
		await dataSource.query(`SET search_path TO ${t.code}`);

		await dataSource.runMigrations();
	}

	await dataSource.destroy();

	console.log('Migración de todos los tenants completada.');
}

void run();
