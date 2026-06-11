import { parseEntity } from './dto-utils/parser';
import { writeDtos } from './dto-utils/writer';
import path from 'path';
import { project } from './dto-utils/project';
import { globSync } from 'glob';

const [domain, moduleName] = process.argv.slice(2);

if (domain && moduleName) {
	const entityPath = path.resolve(
		`src/modules/${domain}/${moduleName}/model/${moduleName}.entity.ts`,
	);

	const parsed = parseEntity(entityPath);

	writeDtos({
		domain,
		moduleName,
		entityName: parsed.entityName,
		fields: parsed.fields,
	});

	process.exit(0);
}

console.log('Generating DTOs for entire project...\n');

const files = globSync('src/modules/**/model/*.entity.ts');

for (const file of files) {
	try {
		const normalizedPath = file.replace(/\\/g, '/');
		const parts = normalizedPath.split('/');

		const domain = parts[2];
		const moduleName = parts[3];

		const parsed = parseEntity(file);

		writeDtos({
			domain,
			moduleName,
			entityName: parsed.entityName,
			fields: parsed.fields,
		});
	} catch (err) {
		console.error(`Error in ${file} - ${err}`);
	}
}

project.getSourceFiles().forEach((sf) => sf.delete());

console.log('\nDone.');
