import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import * as path from 'path';

dotenv.config();

async function run() {
	const tenant = process.argv[2];

	if (!tenant) {
		console.error('❌ Debe indicar el schema: npm run seed:tenant upc');
		process.exit(1);
	}

	console.log(`\n🌱 Iniciando seeding para tenant: ${tenant}\n`);
	console.log('='.repeat(70));

	const seedFiles = [
		'1-load-types.ts',
		'2-core.seed.ts',
		'3-organization.seed.ts',
		'4-auth.seed.ts',
		'5-academic.seed.ts',
		'6-accreditation.seed.ts',
		'7-evaluation.seed.ts',
		'8-evidence.seed.ts',
		'9-ifc.seed.ts',
		'10-improvement.seed.ts',
		'11-survey.seed.ts',
		'12-notifications.seed.ts',
	];

	const seedsDir = path.join(__dirname, 'seeds', 'upc');
	let successCount = 0;
	let failureCount = 0;
	const failures: { file: string; error: string }[] = [];

	for (const seedFile of seedFiles) {
		const seedPath = path.join(seedsDir, seedFile);
		console.log(`\n📝 Ejecutando: ${seedFile}`);
		console.log('-'.repeat(70));

		try {
			execSync(`ts-node -r tsconfig-paths/register "${seedPath}" ${tenant}`, {
				stdio: 'inherit',
				cwd: path.join(__dirname, '../../..'),
			});
			console.log(`✅ ${seedFile} completado exitosamente`);
			successCount++;
		} catch (error) {
			console.error(`❌ Error en ${seedFile}:`, error);
			failureCount++;
			failures.push({
				file: seedFile,
				error: String(error),
			});
		}
	}

	console.log('\n' + '='.repeat(70));
	console.log(`\n📊 RESUMEN DE SEEDING:`);
	console.log(`✅ Exitosos: ${successCount}/${seedFiles.length}`);
	console.log(`❌ Fallidos: ${failureCount}/${seedFiles.length}`);

	if (failures.length > 0) {
		console.log(`\n⚠️  Seeds con error:`);
		failures.forEach(({ file, error }) => {
			console.log(`  - ${file}`);
		});
		process.exit(1);
	} else {
		console.log(`\n🎉 ¡Todos los seeds completados exitosamente para ${tenant}!`);
		process.exit(0);
	}
}

run().catch((error) => {
	console.error('Error fatal:', error);
	process.exit(1);
});
