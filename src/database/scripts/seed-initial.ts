import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import * as path from 'path';

dotenv.config();

/*
 * seed-initial — minimal baseline seed.
 *
 * Seeds only the structural data needed to start working:
 *   - types, core parameters, organization (campuses/faculties/schools), users & staff
 *   - academic: academic periods + programs ONLY
 *   - accreditation: accreditors + commissions + program<->commission links ONLY
 *   - auth: all roles, full module/permission catalog, ADMIN granted to every user,
 *           every user's password reset to "ABET2020"
 *
 * Everything else (courses, study plans, sections, students, grades, outcomes, IFC,
 * evaluations, evidence, improvement, surveys, notifications) is intentionally left out
 * and is expected to come through the bulk upload process.
 *
 * Run:  npm run seed:initial <schema>
 */
async function run() {
	const tenant = process.argv[2];

	if (!tenant) {
		console.error('Schema required: npm run seed:initial <schema>');
		process.exit(1);
	}

	if (!process.env.DB_HOST || !process.env.DB_NAME) {
		console.error('Missing required env vars: DB_HOST, DB_NAME');
		process.exit(1);
	}

	console.log(`\nSeeding initial baseline for tenant: ${tenant}\n`);
	console.log('='.repeat(70));

	const seedFiles = [
		'1-load-types.ts',
		'2-core.seed.ts',
		'3-organization.seed.ts',
		'4-auth.seed.ts',
		'initial-academic.seed.ts',
		'initial-accreditation.seed.ts',
		'initial-auth-roles.seed.ts',
	];

	const seedsDir = path.join(__dirname, 'seeds', 'upc');
	let successCount = 0;
	let failureCount = 0;
	const failures: { file: string; error: string }[] = [];

	for (const seedFile of seedFiles) {
		const seedPath = path.join(seedsDir, seedFile);
		console.log(`\nRunning: ${seedFile}`);
		console.log('-'.repeat(70));

		try {
			execSync(`ts-node --transpile-only -r tsconfig-paths/register "${seedPath}" ${tenant}`, {
				stdio: 'inherit',
				cwd: path.join(__dirname, '../../..'),
			});
			console.log(`Done: ${seedFile}`);
			successCount++;
		} catch (error) {
			console.error(`Failed: ${seedFile}:`, error);
			failureCount++;
			failures.push({
				file: seedFile,
				error: String(error),
			});
		}
	}

	console.log('\n' + '='.repeat(70));
	console.log(`\nSEEDING SUMMARY:`);
	console.log(`Succeeded: ${successCount}/${seedFiles.length}`);
	console.log(`Failed: ${failureCount}/${seedFiles.length}`);

	if (failures.length > 0) {
		console.log(`\nFailed seeds:`);
		failures.forEach(({ file }) => {
			console.log(`  - ${file}`);
		});
		process.exit(1);
	} else {
		console.log(`\nInitial seed completed for ${tenant}.`);
		process.exit(0);
	}
}

run().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
