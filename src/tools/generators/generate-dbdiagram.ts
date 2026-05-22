import fs from 'fs';

const inputFile = process.argv[2];
const outputFile = process.argv[3] || 'output.dbml';

if (!inputFile) {
	console.error('❌ Debes enviar el archivo migration.ts');
	process.exit(1);
}

const content = fs.readFileSync(inputFile, 'utf-8');

/* ---------------- CONFIG ---------------- */

// 🔥 SOLO excluir cuando apunten a .id
const EXCLUDED_TARGET_TABLES = ['types'];

/* ---------------- PARSE CREATE TABLE ---------------- */

const tableRegex = /CREATE TABLE "([^"]+)"\."([^"]+)" \(([\s\S]*?)\);/g;

type Table = {
	schema: string;
	name: string;
	columns: string[];
};

const tables: Table[] = [];

let match;

while ((match = tableRegex.exec(content))) {
	const schema = match[1];
	const name = match[2];
	const body = match[3];

	const columns: string[] = [];

	const parts = body.split(/,(?![^(]*\))/);

	for (let line of parts) {
		line = line.trim();

		if (!line.startsWith('"')) continue;

		const nameMatch = line.match(/^"([^"]+)"/);
		if (!nameMatch) continue;

		const colName = nameMatch[1];

		const typeMatch = line.match(/"[^"]+"\s+(.+?)(?= NOT| DEFAULT| GENERATED| CONSTRAINT|$)/i);
		if (!typeMatch) continue;

		let colType = typeMatch[1].trim();
		colType = mapType(colType);

		const isPK = line.includes('PRIMARY KEY');
		const isNotNull = line.includes('NOT NULL');
		const isUnique = line.includes('UNIQUE');
		const isGenerated = /\bGENERATED\b/i.test(line);

		let colLine = `${colName} ${colType}`;

		if (isPK) colLine += ' [pk]';
		if (isUnique) colLine += ' [unique]';
		if (!isNotNull && !isGenerated) colLine += ' [null]';
		if (isGenerated) colLine += " [note: 'generated']";

		columns.push(colLine);
	}

	tables.push({ schema, name, columns });
}

/* ---------------- PARSE FOREIGN KEYS ---------------- */

const fkRegex = /ALTER TABLE "([^"]+)"\."([^"]+)" ADD CONSTRAINT "[^"]+" FOREIGN KEY \("([^"]+)"\) REFERENCES "([^"]+)"\."([^"]+)"\("([^"]+)"\)/g;

const relations: string[] = [];

// Resolve target schema for FKs by table name. Most table names are unique across
// schemas in this codebase, so this is a safe lookup.
const schemaByTable = new Map<string, string>();
for (const t of tables) schemaByTable.set(t.name, t.schema);

while ((match = fkRegex.exec(content))) {
	const fromSchema = match[1];
	const fromTable = match[2];
	const fromColumn = match[3];

	const toSchema = match[4];
	const toTable = match[5];
	const toColumn = match[6];

	// 🔥 SOLO excluir si apunta a .id de tabla bloqueada
	if (toColumn === 'id' && EXCLUDED_TARGET_TABLES.includes(toTable)) {
		continue;
	}

	relations.push(`Ref: "${fromSchema}"."${fromTable}"."${fromColumn}" > "${toSchema}"."${toTable}"."${toColumn}"`);
}

/* ---------------- BUILD DBML ---------------- */

let output = '';

for (const table of tables) {
	output += `Table "${table.schema}"."${table.name}" {\n`;

	for (const col of table.columns) {
		output += `  ${col}\n`;
	}

	output += '}\n\n';
}

output += relations.join('\n');

/* ---------------- SAVE ---------------- */

fs.writeFileSync(outputFile, output);

console.log(`✅ DBML generado en ${outputFile}`);

/* ---------------- HELPERS ---------------- */

function mapType(type: string): string {
	type = type.toLowerCase();

	if (type.includes('character varying')) return 'varchar';
	if (type.includes('timestamp')) return 'timestamp';
	if (type.includes('numeric')) return 'decimal';
	if (type.includes('boolean')) return 'boolean';
	if (type.includes('jsonb')) return 'json';
	if (type.includes('text')) return 'text';
	if (type.includes('integer')) return 'int';
	if (type.includes('serial')) return 'int';

	return type;
}
