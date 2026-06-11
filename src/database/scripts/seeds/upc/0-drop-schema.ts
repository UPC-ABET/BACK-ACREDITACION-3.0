import simpleDS from '../typeorm.config';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
	const tenant = process.argv[2];

	if (!tenant) {
		console.error('Schema required: npm run seed:drop <schema>');
		process.exit(1);
	}

	if (!process.env.DB_HOST || !process.env.DB_NAME) {
		console.error('Missing required env vars: DB_HOST, DB_NAME');
		process.exit(1);
	}

	const tenantDataSource = simpleDS;
	await tenantDataSource.initialize();

	console.log(`Dropping schema: ${tenant}`);

	await tenantDataSource.query(`DROP SCHEMA IF EXISTS "${tenant}" CASCADE;`);

	await tenantDataSource.destroy();

	console.log('Done.');
}

run().catch(console.error);
