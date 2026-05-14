import * as fs from 'fs';
import * as path from 'path';
import { ENTITY_CONFIG } from './relation-utils/config';

const ROOT = path.resolve('src/modules');

const EXCLUDED_TARGETS: string[] = [];

/* ---------------- UTILIDADES ---------------- */

function toSnakeCaseFromEntity(entityName: string): string {
	return entityName
		.replace('Entity', '')
		.replace(/([a-z])([A-Z])/g, '$1_$2')
		.toLowerCase();
}

function extractEntityName(content: string): string | null {
	const match = content.match(/export class (\w+Entity)/);
	return match ? match[1] : null;
}

/* ---------------- DB DECORATORS ---------------- */

const DB_DECORATORS = [
	'EmailColumn',
	'NameColumn',
	'CodeColumn',
	'PasswordColumn',
	'PhoneColumn',
	'TextShortColumn',
	'TextMediumColumn',
	'TextLargeColumn',
	'TextFullColumn',
	'IntegerFKIDColumn',
	'IntegerColumn',
	'DecimalColumn',
	'BooleanColumn',
	'DateColumn',
	'JsonColumn',
];

function extractDbDecorators(content: string): string[] {
	const found = new Set<string>();

	DB_DECORATORS.forEach((dec) => {
		const regex = new RegExp(`@${dec}\\b`, 'g');
		if (regex.test(content)) {
			found.add(dec);
		}
	});

	return [...found];
}

/* ---------------- RESOLVER CONFIG ---------------- */

function resolveConfigFromColumn(column: string) {
	const clean = column.trim().toLowerCase();

	const base = clean.replace(/_id$/, '');

	// 🔥 match directo primero
	if (ENTITY_CONFIG[base]) {
		return {
			config: ENTITY_CONFIG[base],
			property: base,
		};
	}

	// 🔥 fallback inteligente
	const parts = base.split('_');

	for (let i = 0; i < parts.length; i++) {
		const candidate = parts.slice(i).join('_');

		if (ENTITY_CONFIG[candidate]) {
			return {
				config: ENTITY_CONFIG[candidate],
				property: base,
			};
		}
	}

	console.warn(`❌ ENTITY_CONFIG not found for column: ${column}`);

	return null;
}

/* ---------------- PARSEO ---------------- */

interface FieldRelation {
	column: string;
	property: string;
	entityClass: string;
	relationType: 'many-to-one' | 'one-to-one' | 'one-to-many';
	hasRelationComment: boolean;
	config: {
		entity: string;
		path: string;
		singular: string;
		plural: string;
	};
}

function parseFields(content: string): FieldRelation[] {
	const lines = content.split('\n');
	const fields: FieldRelation[] = [];
	const seen = new Set<string>();

	for (let i = 0; i < lines.length; i++) {
		if (!lines[i].includes('@IntegerFKIDColumn')) continue;

		const nextLine = lines[i + 1] || '';
		const match = nextLine.match(/(\w+)_id/);

		if (!match) continue;

		const column = match[0];

		if (seen.has(column)) continue;
		seen.add(column);

		const resolved = resolveConfigFromColumn(column);
		if (!resolved) continue;

		const prevLine = lines[i - 1] || '';

		const isOneToOne = prevLine.includes('@relation: one-to-one');
		const isOneToMany = prevLine.includes('@relation: one-to-many');

		const hasRelationComment = isOneToOne || isOneToMany;

		let relationType: FieldRelation['relationType'] = 'many-to-one';

		if (isOneToOne) relationType = 'one-to-one';
		if (isOneToMany) relationType = 'one-to-many';

		fields.push({
			column,
			property: resolved.property,
			entityClass: resolved.config.entity,
			relationType,
			hasRelationComment,
			config: resolved.config,
		});
	}

	return fields;
}

/* ---------------- INVERSAS ---------------- */

interface InverseMap {
	[target: string]: {
		sourceEntity: string;
		property: string;
		config: FieldRelation['config'];
		relationType: FieldRelation['relationType'];
	}[];
}

function buildInverseMap(entityName: string, fields: FieldRelation[], map: InverseMap) {
	fields.forEach((f) => {
		// 🔥 SOLO si hay comentario
		if (!f.hasRelationComment) return;

		if (EXCLUDED_TARGETS.includes(f.config.entity)) return;

		if (!map[f.config.entity]) {
			map[f.config.entity] = [];
		}

		map[f.config.entity].push({
			sourceEntity: entityName,
			property: f.property,
			config: f.config,
			relationType: f.relationType,
		});
	});
}

function generateInverseRelations(entityName: string, inverseMap: InverseMap) {
	const entries = inverseMap[entityName] || [];
	if (!entries.length) return '';

	let relations = '';

	entries.forEach((e) => {
		const sourceClass = e.sourceEntity;

		const sourceConfig = Object.values(ENTITY_CONFIG).find((c) => c.entity === sourceClass);
		if (!sourceConfig) return;

		// 🔥 ONE TO MANY
		if (e.relationType === 'one-to-many') {
			relations += `
	@OneToMany(() => ${sourceClass}, (x) => x.${e.property})
	${sourceConfig.plural}: ${sourceClass}[];
`;
		}

		// 🔥 ONE TO ONE
		if (e.relationType === 'one-to-one') {
			relations += `
	@OneToOne(() => ${sourceClass}, (x) => x.${e.property})
	${sourceConfig.singular}: ${sourceClass};
`;
		}
	});

	return relations;
}

/* ---------------- OWN RELATIONS ---------------- */

function generateOwnRelations(entityName: string, fields: FieldRelation[]) {
	let relations = '';

	fields.forEach((f) => {
		if (f.relationType === 'one-to-one') {
			relations += `
	@OneToOne(() => ${f.config.entity}, (x) => x.${toSnakeCaseFromEntity(entityName)})
	@JoinColumn({ name: '${f.column}' })
	${f.property}: ${f.config.entity};
`;
			return;
		}

		// 🔥 DEFAULT SIEMPRE ManyToOne
		relations += `
	@ManyToOne(() => ${f.config.entity})
	@JoinColumn({ name: '${f.column}' })
	${f.property}: ${f.config.entity};
`;
	});

	return relations;
}

/* ---------------- IMPORTS ---------------- */

function buildImportPath(configPath: string) {
	const module = configPath.split('/').pop();
	return `src/modules/${configPath}/model/${module}.entity`;
}

function injectImports(content: string, fields: FieldRelation[], entityName: string, inverseMap: InverseMap) {
	const lines = content.split('\n');

	const body = lines.filter((l) => !l.startsWith('import'));

	const entitySet = new Set<string>();

	fields.forEach((f) => {
		if (f.config.entity !== entityName) {
			entitySet.add(f.config.entity);
		}
	});

	const inverses = inverseMap[entityName] || [];
	inverses.forEach((e) => {
		if (e.sourceEntity !== entityName) {
			entitySet.add(e.sourceEntity);
		}
	});

	const imports: string[] = [];

	imports.push(`import { Entity, ManyToOne, OneToOne, OneToMany, JoinColumn } from 'typeorm';`);
	imports.push(`import { BaseEntity } from 'src/commons/base.entity';`);

	const dbDecorators = extractDbDecorators(content);
	if (dbDecorators.length) {
		imports.push(`import { ${dbDecorators.join(', ')} } from 'src/commons/configs/db.configs';`);
	}

	[...entitySet].sort().forEach((entity) => {
		const config = Object.values(ENTITY_CONFIG).find((c) => c.entity === entity);
		if (!config) return;

		imports.push(`import { ${entity} } from '${buildImportPath(config.path)}';`);
	});

	return `${imports.join('\n')}\n\n${body.join('\n')}`;
}

/* ---------------- REEMPLAZO ---------------- */

function replaceRelationsBlock(content: string, relations: string) {
	const marker = '// %% RELACIONES';

	const startIndex = content.indexOf(marker);
	if (startIndex === -1) return content;

	// 🔥 encontrar el inicio del bloque
	const before = content.substring(0, startIndex + marker.length);

	// 🔥 desde ahí buscamos la última llave de la clase
	const afterMarker = content.substring(startIndex);

	const closingIndex = afterMarker.lastIndexOf('}');
	if (closingIndex === -1) return content;

	// 🔥 reconstrucción limpia
	return `${before}\n${relations}\n}`;
}

/* ---------------- WALK ---------------- */

function walk(dir: string, files: string[] = []) {
	fs.readdirSync(dir).forEach((file) => {
		const full = path.join(dir, file);

		if (fs.statSync(full).isDirectory()) walk(full, files);
		else if (file.endsWith('.entity.ts')) files.push(full);
	});

	return files;
}

/* ---------------- MAIN ---------------- */

function run() {
	const files = walk(ROOT);
	const inverseMap: InverseMap = {};

	const parsed: any[] = [];

	files.forEach((filePath) => {
		const content = fs.readFileSync(filePath, 'utf-8');
		const entityName = extractEntityName(content);
		if (!entityName) return;

		const fields = parseFields(content);

		parsed.push({ filePath, entityName, fields });

		buildInverseMap(entityName, fields, inverseMap);
	});

	parsed.forEach(({ filePath, entityName, fields }) => {
		let content = fs.readFileSync(filePath, 'utf-8');

		const own = generateOwnRelations(entityName, fields);
		const inverse = generateInverseRelations(entityName, inverseMap);

		const finalRelations = own + '\n' + inverse;

		content = injectImports(content, fields, entityName, inverseMap);
		content = replaceRelationsBlock(content, finalRelations);

		fs.writeFileSync(filePath, content);

		console.log(`✅ ${filePath}`);
	});
}

run();
