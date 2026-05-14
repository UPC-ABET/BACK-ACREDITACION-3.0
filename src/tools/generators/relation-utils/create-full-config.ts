import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve('src/modules');
const OUTPUT = path.resolve('src/tools/entity-relations-generator/config.ts');

/* ---------------- WALK ---------------- */

function walk(dir: string, files: string[] = []) {
	fs.readdirSync(dir).forEach((file) => {
		const full = path.join(dir, file);

		if (fs.statSync(full).isDirectory()) {
			walk(full, files);
		} else if (file.endsWith('.entity.ts')) {
			files.push(full);
		}
	});
	return files;
}

/* ---------------- EXTRACT ---------------- */

function extractEntityName(content: string): string | null {
	const match = content.match(/export class (\w+Entity)/);
	return match ? match[1] : null;
}

function extractTableName(content: string): string | null {
	const match = content.match(/@Entity\s*\(\s*\{\s*name:\s*['"`](.+?)['"`]\s*\}\s*\)/);
	return match ? match[1] : null;
}

/* ---------------- NORMALIZE ---------------- */

function normalizeTableName(name: string): string {
	return name.replace(/-/g, '_');
}

function inferSingular(plural: string): string {
	if (plural.endsWith('ies')) return plural.slice(0, -3) + 'y';
	if (plural.endsWith('s') && !plural.endsWith('ss')) return plural.slice(0, -1);
	return plural;
}

/**
 * src/modules/care/medical-encounters/model/medical-encounters.entity.ts
 * → care/medical-encounters
 */
function extractModulePath(fullPath: string): string {
	const match = fullPath.match(/src\/modules\/(.+)\/model/);
	return match ? match[1] : '';
}

/* ---------------- MAIN ---------------- */

function run() {
	const files = walk(ROOT);

	const entries: string[] = [];

	files.forEach((filePath) => {
		const content = fs.readFileSync(filePath, 'utf-8');

		const entity = extractEntityName(content);
		const tableRaw = extractTableName(content);

		if (!entity || !tableRaw) return;

		const plural = normalizeTableName(tableRaw);
		const singular = inferSingular(plural);
		const modulePath = extractModulePath(filePath.replace(/\\/g, '/'));

		entries.push(`
		${singular}: {
				entity: '${entity}',
				path: '${modulePath}',
				singular: '${singular}',
				plural: '${plural}',
			},`);
	});

	const fileContent = `export const ENTITY_CONFIG: Record<string, {
			entity: string;
			path: string;
			singular: string;
			plural: string;
		}> = {${entries.join('\n')}
		};
	`;

	fs.writeFileSync(OUTPUT, fileContent);

	console.log('✅ config.ts generado automáticamente');
}

run();
