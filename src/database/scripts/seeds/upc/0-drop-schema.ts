import simpleDS from '../typeorm.config';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
	const tenant = process.argv[2];

	if (!tenant) {
		console.error('Debe indicar el schema: npm run seed:tenant upc');
		process.exit(1);
	}

	const tenantDataSource = simpleDS;
	await tenantDataSource.initialize();

	console.log(`🌱 Dropping schema: ${tenant}`);

	await tenantDataSource.query(`DROP SCHEMA IF EXISTS "${tenant}" CASCADE;`);

	await tenantDataSource.destroy();

	console.log('✅ Seed completado.');
}

run().catch(console.error);
