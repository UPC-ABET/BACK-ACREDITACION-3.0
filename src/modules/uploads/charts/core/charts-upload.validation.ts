import { ChartRow } from '../model/charts-upload.types';
import { chartsUploadStrings } from '../config/strings/charts-upload.validation';

// Lookups pre-cargados con queries set-based (1 query por dimensión, no N+1).
export interface ChartsLookups {
	chartLevelIdByLevel: Map<number, number>;        // organization.chart_levels.level (1..6) → id
	entityTypeIdByCode: Map<string, number>;         // core.types/ENTITY_TYPE.code → id
	staffIdByCode: Map<string, number>;              // organization.staff.code → id
	campusIdByCode: Map<string, number>;             // organization.campuses.code → id
	existingChartIdByEntityCode: Map<string, number>;// charts en el período (para parent resolution + dedup)
	rowEntityCodes: Set<string>;                     // entity_codes presentes en el Excel (parents intra-lote)
}

export interface ResolvedChartRow {
	rowNumber: number;
	errors: string[];
	entityCode?: string;
	name?: string;
	levelInt?: number;
	chartLevelId?: number;
	entityTypeId?: number;
	staffId?: number;
	campusId?: number;
	parentEntityCode?: string; // se resuelve a id en el segundo pase del service
}

export class ChartsUploadValidation {
	static validateRow(row: ChartRow, lookups: ChartsLookups): ResolvedChartRow {
		const errors: string[] = [];

		const entityCode = (row.entityCode ?? '').trim();
		const name = (row.name ?? '').trim();
		const levelRaw = (row.level ?? '').trim();
		const levelInt = levelRaw === '' ? NaN : Number(levelRaw);
		const entityTypeCode = (row.entityTypeCode ?? '').trim().toUpperCase();
		const responsible = (row.responsibleUserName ?? '').trim();
		const campusCode = (row.campusCode ?? '').trim();
		const parentEntityCode = (row.parentEntityCode ?? '').trim();

		const chartLevelId = Number.isInteger(levelInt) ? lookups.chartLevelIdByLevel.get(levelInt) : undefined;
		const entityTypeId = lookups.entityTypeIdByCode.get(entityTypeCode);
		const staffId = lookups.staffIdByCode.get(responsible);
		const campusId = campusCode === '' ? undefined : lookups.campusIdByCode.get(campusCode);

		// Regla 1: entity_code no vacío.
		if (entityCode === '') errors.push(chartsUploadStrings.error.entityCodeEmpty);

		// Regla 2: nombre no vacío.
		if (name === '') errors.push(chartsUploadStrings.error.nameEmpty);

		// Regla 3: nivel válido (1..6 → debe existir en chart_levels).
		if (!Number.isInteger(levelInt) || chartLevelId === undefined) errors.push(chartsUploadStrings.error.levelInvalid);

		// Regla 4: tipo de entidad reconocido.
		if (entityTypeId === undefined) errors.push(chartsUploadStrings.error.entityTypeInvalid);

		// Regla 5: responsable existe en staff.
		if (responsible === '' || staffId === undefined) errors.push(chartsUploadStrings.error.responsibleNotFound);

		// Regla 6: sede (opcional) — si se da, debe existir.
		if (campusCode !== '' && campusId === undefined) errors.push(chartsUploadStrings.error.campusNotFound);

		// Regla 7: padre — si se da, debe existir en lote o ya en BD.
		if (parentEntityCode !== '' && !lookups.rowEntityCodes.has(parentEntityCode) && !lookups.existingChartIdByEntityCode.has(parentEntityCode)) {
			errors.push(chartsUploadStrings.error.parentNotFound);
		}

		// Regla 8: dedup por entity_code en el período.
		if (entityCode !== '' && lookups.existingChartIdByEntityCode.has(entityCode)) {
			errors.push(chartsUploadStrings.error.chartAlreadyExists);
		}

		return {
			rowNumber: row.rowNumber,
			errors,
			entityCode,
			name,
			levelInt: Number.isInteger(levelInt) ? levelInt : undefined,
			chartLevelId,
			entityTypeId,
			staffId,
			campusId,
			parentEntityCode: parentEntityCode === '' ? undefined : parentEntityCode,
		};
	}

	static validateAll(rows: ChartRow[], lookups: ChartsLookups): ResolvedChartRow[] {
		return rows.map((row) => this.validateRow(row, lookups));
	}
}
