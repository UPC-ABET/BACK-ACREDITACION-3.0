import simpleDS from '../typeorm.config';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
	const tenant = process.argv[2];

	if (!tenant) {
		console.error('Schema required: npm run seed:tenant <schema>');
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
