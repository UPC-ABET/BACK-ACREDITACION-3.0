import * as fs from 'fs';
import * as path from 'path';
import { ENTITY_CONFIG } from './relation-utils/config';

const ROOT = path.resolve('src/modules');

const EXCLUDED_TARGETS: string[] = [];

/* ---------------- UTILITIES ---------------- */

function toCamelCaseFromEntity(entityName: string): string {
	const base = entityName.replace('Entity', '');
	return base.charAt(0).toLowerCase() + base.slice(1);
}

function camelToSnake(name: string): string {
	return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function extractEntityName(content: string): string | null {
	const match = content.match(/export class (\w+Entity)/);
	return match ? match[1] : null;
}

function extractTableName(content: string): string | null {
	const match = content.match(/@Entity\s*\(\s*\{\s*name:\s*['"`]([^'"`]+)['"`]/);
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

/* ---------------- RESOLVE CONFIG ---------------- */

/**
 * `property` here is a camelCase TS identifier (e.g. `studyPlanCourseId` stripped to
 * `studyPlanCourse`). `ENTITY_CONFIG` is keyed by the same camelCase shape.
 */
function resolveConfigFromProperty(property: string) {
	const base = property.replace(/Id$/, '');

	if (ENTITY_CONFIG[base]) {
		return {
			config: ENTITY_CONFIG[base],
			property: base,
		};
	}

	// Fallback: try shorter suffixes — e.g. `instrumentTypeId` falls back to `type`
	// when no `instrumentType` config exists.
	const tokens = base.match(/[A-Z]?[a-z0-9]+/g) || [];

	for (let i = 1; i < tokens.length; i++) {
		const tail = tokens.slice(i);
		const candidate = tail[0].charAt(0).toLowerCase() + tail[0].slice(1) + tail.slice(1).join('');

		if (ENTITY_CONFIG[candidate]) {
			return {
				config: ENTITY_CONFIG[candidate],
				property: base,
			};
		}
	}

	console.warn(`ENTITY_CONFIG not found for property: ${property}`);

	return null;
}

/* ---------------- PARSING ---------------- */

interface FieldRelation {
	/** TS property name on the FK column, e.g. `studyPlanCourseId`. */
	fkProperty: string;
	/** DB column name derived from `fkProperty`, e.g. `study_plan_course_id`. */
	dbColumn: string;
	/** Relation property name (TS, camelCase) — `fkProperty` with `Id` stripped. */
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
		// Match the FK property declaration `someThingId: number;`.
		const match = nextLine.match(/\b([a-z][a-zA-Z0-9]*Id)\b/);

		if (!match) continue;

		const fkProperty = match[1];

		if (seen.has(fkProperty)) continue;
		seen.add(fkProperty);

		const resolved = resolveConfigFromProperty(fkProperty);
		if (!resolved) continue;

		const prevLine = lines[i - 1] || '';

		const isOneToOne = prevLine.includes('@relation: one-to-one');
		const isOneToMany = prevLine.includes('@relation: one-to-many');

		const hasRelationComment = isOneToOne || isOneToMany;

		let relationType: FieldRelation['relationType'] = 'many-to-one';

		if (isOneToOne) relationType = 'one-to-one';
		if (isOneToMany) relationType = 'one-to-many';

		fields.push({
			fkProperty,
			dbColumn: camelToSnake(fkProperty),
			property: resolved.property,
			entityClass: resolved.config.entity,
			relationType,
			hasRelationComment,
			config: resolved.config,
		});
	}

	return fields;
}

/* ---------------- INVERSE RELATIONS ---------------- */

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

		if (e.relationType === 'one-to-many') {
			relations += `
	@OneToMany(() => ${sourceClass}, (x) => x.${e.property})
	${sourceConfig.plural}: ${sourceClass}[];
`;
		}

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

function generateOwnRelations(entityName: string, tableName: string, fields: FieldRelation[]) {
	let relations = '';
	const ownerProperty = toCamelCaseFromEntity(entityName);

	fields.forEach((f) => {
		const fkName = `FK_${tableName}_${f.dbColumn}`;
		if (f.relationType === 'one-to-one') {
			relations += `
	@OneToOne(() => ${f.config.entity}, (x) => x.${ownerProperty})
	@JoinColumn({ name: '${f.dbColumn}', foreignKeyConstraintName: '${fkName}' })
	${f.property}: ${f.config.entity};
`;
			return;
		}

		relations += `
	@ManyToOne(() => ${f.config.entity})
	@JoinColumn({ name: '${f.dbColumn}', foreignKeyConstraintName: '${fkName}' })
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

function injectImports(
	content: string,
	fields: FieldRelation[],
	entityName: string,
	inverseMap: InverseMap,
) {
	const lines = content.split('\n');

	const body = lines.filter((l) => !l.startsWith('import'));

	const preservedTypeImports = lines.filter((l) => l.startsWith('import type '));

	const extraEntityDecorators = lines.filter(
		(l) => l.startsWith('@Unique(') || l.startsWith('@Index('),
	);

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

	imports.push(
		`import { Entity, ManyToOne, OneToOne, OneToMany, JoinColumn${extraEntityDecorators.some((l) => l.startsWith('@Unique(')) ? ', Unique' : ''}${extraEntityDecorators.some((l) => l.startsWith('@Index(')) ? ', Index' : ''} } from 'typeorm';`,
	);
	imports.push(`import { BaseEntity } from 'src/commons/base.entity';`);

	const dbDecorators = extractDbDecorators(content);
	if (dbDecorators.length) {
		imports.push(`import { ${dbDecorators.join(', ')} } from 'src/commons/configs/db.configs';`);
	}

	preservedTypeImports.forEach((l) => imports.push(l));

	[...entitySet].sort().forEach((entity) => {
		const config = Object.values(ENTITY_CONFIG).find((c) => c.entity === entity);
		if (!config) return;

		imports.push(`import { ${entity} } from '${buildImportPath(config.path)}';`);
	});

	return `${imports.join('\n')}\n\n${body.join('\n')}`;
}

/* ---------------- REPLACE BLOCK ---------------- */

function replaceRelationsBlock(content: string, relations: string) {
	const marker = '// %% RELATIONS';

	const startIndex = content.indexOf(marker);
	if (startIndex === -1) return content;

	const before = content.substring(0, startIndex + marker.length);

	const afterMarker = content.substring(startIndex);

	const closingIndex = afterMarker.lastIndexOf('}');
	if (closingIndex === -1) return content;

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

		const tableName = extractTableName(content);
		if (!tableName) {
			console.warn(`No @Entity({ name }) declaration found in ${filePath}; skipping.`);
			return;
		}

		const fields = parseFields(content);

		parsed.push({ filePath, entityName, tableName, fields });

		buildInverseMap(entityName, fields, inverseMap);
	});

	parsed.forEach(({ filePath, entityName, tableName, fields }) => {
		let content = fs.readFileSync(filePath, 'utf-8');

		const own = generateOwnRelations(entityName, tableName, fields);
		const inverse = generateInverseRelations(entityName, inverseMap);

		const finalRelations = own + '\n' + inverse;

		content = injectImports(content, fields, entityName, inverseMap);
		content = replaceRelationsBlock(content, finalRelations);

		fs.writeFileSync(filePath, content);

		console.log(`Done: ${filePath}`);
	});
}

run();
