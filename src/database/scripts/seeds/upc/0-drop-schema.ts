import simpleDS from '../typeorm.config';
import * as dotenv from 'dotenv';

dotenv.config();

// Application schemas created by the migrations. Dropping these wipes all data for a
// clean rebuild (dev only). The migration tracking tables (public.migrations,
// public.typeorm_metadata) are also dropped so a following `migration:run` re-applies
// every migration from scratch.
const APP_SCHEMAS = [
	'academic',
	'accreditation',
	'organization',
	'evidence',
	'survey',
	'improvement',
	'ifc',
	'evaluation',
	'core',
	'audit',
];

async function run() {
	if (!process.env.DB_HOST || !process.env.DB_NAME) {
		console.error('Missing required env vars: DB_HOST, DB_NAME');
		process.exit(1);
	}

	const dataSource = simpleDS;
	await dataSource.initialize();

	console.log(`Dropping schemas: ${APP_SCHEMAS.join(', ')}`);
	for (const schema of APP_SCHEMAS) {
		await dataSource.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE;`);
	}

	// Reset migration tracking so `migration:run` re-applies every migration cleanly.
	await dataSource.query(`DROP TABLE IF EXISTS "public"."migrations" CASCADE;`);
	await dataSource.query(`DROP TABLE IF EXISTS "public"."typeorm_metadata" CASCADE;`);

	await dataSource.destroy();

	console.log('Done.');
}

run().catch(console.error);
