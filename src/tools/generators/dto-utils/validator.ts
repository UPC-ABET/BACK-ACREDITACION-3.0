import fs from 'fs';
import path from 'path';

function formatPath(filePath: string) {
	return path.relative(process.cwd(), filePath);
}

function logError(type: string, entityName: string, filePath: string, extra?: string) {
	const p = path.relative(process.cwd(), filePath);

	const shortEntity = entityName.replace('Entity', '');
	const detail = extra ? ` | ${extra}` : '';

	console.warn(`⚠️ ${shortEntity} | ${type}${detail} → ${p}:1:1`);
}

function logSuccess(entityName: string, filePath: string) {
	const p = path.relative(process.cwd(), filePath);
	const shortEntity = entityName.replace('Entity', '');

	console.log(`✅ ${shortEntity} → ${p}`);
}

export function validateDtos(filePath: string, entityName: string): void {
	if (!fs.existsSync(filePath)) return;

	const content = fs.readFileSync(filePath, 'utf-8');

	// 🔥 BLOQUEO MANUAL (único que sí importa)
	if (content.includes('no-override')) {
		logError('🚫 Archivo protegido (no-override)', entityName, filePath);
		return;
	}

	const matches = content.match(/export class (\w+)/g) || [];
	const classNames = matches.map((m: any) => m.replace('export class ', '').trim());

	let createCount = 0;
	let updateCount = 0;
	let filterCount = 0;

	for (const name of classNames) {
		if (name.startsWith('Create') && name.endsWith('Dto')) createCount++;
		if (name.startsWith('Update') && name.endsWith('Dto')) updateCount++;
		if (name.startsWith('Filter') && name.endsWith('Dto')) filterCount++;
	}

	// 🔥 SOLO ALERTAS (NO BLOQUEA)
	if (createCount !== 1 || updateCount !== 1 || filterCount !== 1) {
		logError('⚠️ Estructura DTO no estándar', entityName, filePath, `Create:${createCount}, Update:${updateCount}, Filter:${filterCount}`);
	} else {
		logSuccess(entityName, filePath);
	}
}
