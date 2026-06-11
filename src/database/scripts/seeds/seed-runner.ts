import { DataSource } from 'typeorm';
import simpleDS from './typeorm.config';
import * as dotenv from 'dotenv';

dotenv.config();

const sqlEscape = (s: string) => s.replace(/'/g, "''");

export const i18n = (es: string, en?: string) => sqlEscape(JSON.stringify({ es, en: en ?? es }));

export function runSeed(seedName: string, seed: (dataSource: DataSource) => Promise<void>) {
	async function run() {
		if (!process.env.DB_HOST || !process.env.DB_NAME) {
			console.error('Missing required env vars: DB_HOST, DB_NAME');
			process.exit(1);
		}

		const dataSource = simpleDS;
		await dataSource.initialize();

		try {
			console.log(`Seeding ${seedName}`);
			await seed(dataSource);
		} finally {
			await dataSource.destroy();
		}

		console.log(`Seed ${seedName} completed.`);
	}

	run().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
