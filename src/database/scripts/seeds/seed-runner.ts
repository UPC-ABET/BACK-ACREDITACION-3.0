import { DataSource } from 'typeorm';
import simpleDS from './typeorm.config';
import * as dotenv from 'dotenv';

dotenv.config();

const sqlEscape = (s: string) => s.replace(/'/g, "''");

export const i18n = (es: string, en?: string) => sqlEscape(JSON.stringify({ es, en: en ?? es }));

export function runTenantSeed(
	seedName: string,
	seed: (dataSource: DataSource, tenant: string) => Promise<void>,
) {
	async function run() {
		const tenant = process.argv[2];

		if (!tenant) {
			console.error('Schema required: npm run seed:tenant <schema>');
			process.exit(1);
		}

		if (!process.env.DB_HOST || !process.env.DB_NAME) {
			console.error('Missing required env vars: DB_HOST, DB_NAME');
			process.exit(1);
		}

		const tenantDataSource = simpleDS;
		await tenantDataSource.initialize();

		try {
			console.log(`Seeding ${seedName}: ${tenant}`);
			await seed(tenantDataSource, tenant);
		} finally {
			await tenantDataSource.destroy();
		}

		console.log(`Seed ${seedName} completed.`);
	}

	run().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
