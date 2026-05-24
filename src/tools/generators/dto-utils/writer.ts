import fs from 'fs';
import path from 'path';
import { mapValidator, mapLength, mapExample } from './mapper';
import { validateDtos } from './validator';

/* ---------------- HELPERS ---------------- */

function isRelationField(f: any) {
	return (
		f.decorators?.includes('ManyToOne') ||
		f.decorators?.includes('OneToMany') ||
		f.decorators?.includes('OneToOne') ||
		f.decorators?.includes('ManyToMany')
	);
}

function isDuplicateRelation(fields: any[], f: any) {
	if (!f.name || f.name.endsWith('_id')) return false;
	return fields.some((x) => x.name === `${f.name}_id`);
}

function shouldIncludeField(fields: any[], f: any, excludeList: string[]) {
	if (excludeList.includes(f.name)) return false;
	if (isRelationField(f)) return false;
	if (isDuplicateRelation(fields, f)) return false;
	if (f.type === 'never') return false;
	return true;
}

/* ---------------- GENERADOR BLOQUES ---------------- */

function buildCreateDto(entity: string, fields: any[]) {
	return `
export class Create${entity}Dto {
${fields
	.map((f: any) => {
		const validator = mapValidator(f.type);
		const length = mapLength(f.decorators || []);
		const example = mapExample(f.type, f.name, f.decorators || []);

		return `
	${f.isOptional ? '@IsOptional()' : ''}
	${validator}
	${length ? `@Length(1, ${length})` : ''}
	@ApiProperty({ example: ${example}, required: ${!f.isOptional} })
	${f.name}${f.isOptional ? '?' : ''}: ${f.type};
	`;
	})
	.join('\n')}
}
`;
}

function buildUpdateDto(entity: string, fields: any[]) {
	return `
export class Update${entity}Dto {
${fields
	.map((f: any) => {
		const validator = mapValidator(f.type);
		const length = mapLength(f.decorators || []);
		const example = mapExample(f.type, f.name, f.decorators || []);

		return `
	@IsOptional()
	${validator}
	${length ? `@Length(1, ${length})` : ''}
	@ApiProperty({ example: ${example}, required: false })
	${f.name}?: ${f.type};
	`;
	})
	.join('\n')}
}
`;
}

function buildFilterDto(entity: string, fields: any[]) {
	return `
export class Filter${entity}Dto {
${fields
	.map((f: any) => {
		const example = mapExample(f.type, f.name, f.decorators || []);

		return `
	@IsOptional()
	@ApiProperty({ example: ${example}, required: false })
	${f.name}?: ${f.type};
	`;
	})
	.join('\n')}
}
`;
}

/* ---------------- REEMPLAZO ---------------- */

function replaceOrAppend(content: string, className: string, newBlock: string) {
	const regex = new RegExp(`export class ${className}[\\s\\S]*?\\n}`, 'm');

	if (regex.test(content)) {
		return content.replace(regex, newBlock.trim());
	}

	return content + '\n\n' + newBlock;
}

/* ---------------- IMPORTS (MERGE INTELIGENTE) ---------------- */

// 🔥 fuentes que SIEMPRE deben importarse con `import type` (tipos puros,
// requeridos por `isolatedModules` cuando se usan en signaturas decoradas)
const TYPE_ONLY_SOURCES = new Set(['src/shared/types/i18n']);

function extractExistingImports(content: string) {
	const lines = content.split('\n');

	const importMap: Record<string, Set<string>> = {};

	for (const line of lines) {
		if (!line.startsWith('import')) continue;

		const match = line.match(/import\s+(?:type\s+)?{([^}]+)}\s+from\s+'([^']+)'/);
		if (!match) continue;

		const names = match[1].split(',').map((x) => x.trim());
		const source = match[2];

		if (!importMap[source]) {
			importMap[source] = new Set();
		}

		names.forEach((n) => importMap[source].add(n));
	}

	return importMap;
}

function buildRequiredImports(content: string) {
	const imports: Record<string, Set<string>> = {};

	function add(source: string, name: string) {
		if (!imports[source]) imports[source] = new Set();
		imports[source].add(name);
	}

	if (content.includes('@IsString')) add('class-validator', 'IsString');
	if (content.includes('@IsNumber')) add('class-validator', 'IsNumber');
	if (content.includes('@IsBoolean')) add('class-validator', 'IsBoolean');
	if (content.includes('@IsOptional')) add('class-validator', 'IsOptional');
	if (content.includes('@IsDate')) add('class-validator', 'IsDate');
	if (content.includes('@IsObject')) add('class-validator', 'IsObject');
	if (content.includes('@Length')) add('class-validator', 'Length');

	if (content.includes('@ApiProperty')) add('@nestjs/swagger', 'ApiProperty');

	if (/[:\s]I18nText\b/.test(content)) add('src/shared/types/i18n', 'I18nText');

	return imports;
}

function mergeImports(content: string) {
	const existing = extractExistingImports(content);
	const required = buildRequiredImports(content);

	const finalImports: string[] = [];

	const allSources = new Set([...Object.keys(existing), ...Object.keys(required)]);

	allSources.forEach((source) => {
		const names = new Set<string>();

		if (existing[source]) {
			existing[source].forEach((n) => names.add(n));
		}

		if (required[source]) {
			required[source].forEach((n) => names.add(n));
		}

		if (names.size) {
			const kw = TYPE_ONLY_SOURCES.has(source) ? 'import type' : 'import';
			finalImports.push(`${kw} { ${[...names].sort().join(', ')} } from '${source}';`);
		}
	});

	const body = content
		.split('\n')
		.filter((line) => !line.startsWith('import '))
		.join('\n');

	return `${finalImports.join('\n')}\n\n${body.trim()}\n`;
}

/* ---------------- MAIN ---------------- */

export function writeDtos({ domain, moduleName, entityName, fields }: any) {
	const outputPath = path.resolve(
		`src/modules/${domain}/${moduleName}/model/${moduleName}.dtos.ts`,
	);

	const entity = entityName.replace('Entity', '');

	const EXCLUDE_CREATE = ['id', 'created_at', 'updated_at'];
	const EXCLUDE_UPDATE = ['id', 'created_at', 'updated_at'];
	const EXCLUDE_FILTER = ['created_at', 'updated_at'];

	const createFields = fields.filter((f: any) => shouldIncludeField(fields, f, EXCLUDE_CREATE));
	const updateFields = fields.filter((f: any) => shouldIncludeField(fields, f, EXCLUDE_UPDATE));
	const filterFields = fields.filter((f: any) => shouldIncludeField(fields, f, EXCLUDE_FILTER));

	const createDto = buildCreateDto(entity, createFields);
	const updateDto = buildUpdateDto(entity, updateFields);
	const filterDto = buildFilterDto(entity, filterFields);

	let content: string;

	if (fs.existsSync(outputPath)) {
		content = fs.readFileSync(outputPath, 'utf-8');

		if (content.includes('no-override')) {
			console.warn(`🚫 ${entity} DTO protegido`);
			return;
		}

		validateDtos(outputPath, entityName);
	} else {
		content = `
		// %% AUTO-GENERATED
		`;
	}

	content = replaceOrAppend(content, `Create${entity}Dto`, createDto);
	content = replaceOrAppend(content, `Update${entity}Dto`, updateDto);
	content = replaceOrAppend(content, `Filter${entity}Dto`, filterDto);

	content = mergeImports(content);

	fs.writeFileSync(outputPath, content);

	console.log(`✅ DTO actualizado: ${entity}`);
}
