import baseDataSource from '../typeorm.config';

async function run() {
	const tenant = process.argv[2];

	if (!tenant) {
		console.error('Debe indicar el schema');
		process.exit(1);
	}

	console.log(`Migrando schema: ${tenant}`);

	const tenantDataSource = baseDataSource.setOptions({
		entities: ['src/**/*.entity.ts'],
		migrations: ['src/database/migrations/*.ts'],
		schema: tenant,
		migrationsTableName: 'migrations',
	});
	await tenantDataSource.initialize();

	await tenantDataSource.query(`CREATE SCHEMA IF NOT EXISTS "${tenant}"`);
	// 2️⃣ Forzar el search_path REAL
	await tenantDataSource.query(`SET search_path TO "${tenant}"`);

	await tenantDataSource.runMigrations();

	await tenantDataSource.destroy();

	console.log('Migración completada.');
}

void run();
