import baseDataSource from '../typeorm.config';

async function run() {
	const tenant = process.argv[2];

	if (!tenant) {
		console.error('Schema required: npm run migrate:tenant <schema>');
		process.exit(1);
	}

	if (!process.env.DB_HOST || !process.env.DB_NAME) {
		console.error('Missing required env vars: DB_HOST, DB_NAME');
		process.exit(1);
	}

	console.log(`Migrating schema: ${tenant}`);

	const tenantDataSource = baseDataSource.setOptions({
		entities: ['src/**/*.entity.ts'],
		migrations: ['src/database/migrations/*.ts'],
		schema: tenant,
		migrationsTableName: 'migrations',
	});
	await tenantDataSource.initialize();

	await tenantDataSource.query(`CREATE SCHEMA IF NOT EXISTS "${tenant}"`);
	await tenantDataSource.query(`SET search_path TO "${tenant}"`);

	await tenantDataSource.runMigrations();

	await tenantDataSource.destroy();

	console.log('Migration completed.');
}

void run();
