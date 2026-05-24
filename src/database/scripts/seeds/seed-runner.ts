import { DataSource } from 'typeorm';
import simpleDS from './typeorm.config';
import * as dotenv from 'dotenv';

dotenv.config();

// Escapa apostrofes para embebido seguro en literales SQL (`'…'`).
// El JSON.stringify se mantiene: protege saltos de linea y comillas dobles del JSON,
// luego doblamos las simples para sobrevivir el wrapping `'${...}'::jsonb` del seed.
const sqlEscape = (s: string) => s.replace(/'/g, "''");

export const i18n = (es: string, en?: string) => sqlEscape(JSON.stringify({ es, en: en ?? es }));

export function runTenantSeed(
	seedName: string,
	seed: (dataSource: DataSource, tenant: string) => Promise<void>,
) {
	async function run() {
		const tenant = process.argv[2];

		if (!tenant) {
			console.error('Debe indicar el schema: npm run seed:tenant upc');
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

		console.log(`Seed ${seedName} completado.`);
	}

	run().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
