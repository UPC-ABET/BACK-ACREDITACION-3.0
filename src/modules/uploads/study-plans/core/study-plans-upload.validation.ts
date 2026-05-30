import { StudyPlanRow, parsePrerequisites } from '../model/study-plans-upload.types';
import { studyPlansUploadStrings } from '../config/strings/study-plans-upload.validation';

// Lookups pre-cargados con queries set-based.
export interface StudyPlansLookups {
	programIdByCode: Map<string, number>;            // academic.programs.code → id
	levelTypeIdByCode: Map<string, number>;          // core.types/LEVEL_TYPE.code → id
	existingCourseIdByCode: Map<string, number>;     // academic.courses.code → id (case-insensitive lowered key)
	existingStudyPlanIdByCode: Map<string, number>;  // academic.study_plans.code → id
	existingSpcCodes: Set<string>;                   // `${studyPlanCode}|${courseCode}` ya en la malla del período (dedup)
	rowCourseCodes: Set<string>;                     // courseCodes presentes en el lote (para resolver requisitos intra-lote)
}

export interface ResolvedStudyPlanRow {
	rowNumber: number;
	errors: string[];
	studyPlanCode?: string;
	studyPlanName?: string;
	programId?: number;
	courseCode?: string;
	courseName?: string;
	levelTypeId?: number;
	prerequisites?: string[];
}

export class StudyPlansUploadValidation {
	static validateRow(row: StudyPlanRow, lookups: StudyPlansLookups): ResolvedStudyPlanRow {
		const errors: string[] = [];

		const studyPlanCode = (row.studyPlanCode ?? '').trim();
		const studyPlanName = (row.studyPlanName ?? '').trim();
		const programId = lookups.programIdByCode.get((row.programCode ?? '').trim());
		const courseCode = (row.courseCode ?? '').trim();
		const courseName = (row.courseName ?? '').trim();
		const levelTypeId = lookups.levelTypeIdByCode.get((row.levelTypeCode ?? '').trim().toUpperCase());
		const prerequisites = parsePrerequisites(row.prerequisites);

		// Regla 1: código de malla no vacío.
		if (studyPlanCode === '') errors.push(studyPlansUploadStrings.error.studyPlanCodeEmpty);

		// Regla 2: carrera existe.
		if (programId === undefined) errors.push(studyPlansUploadStrings.error.programNotFound);

		// Regla 3: código de curso no vacío.
		if (courseCode === '') errors.push(studyPlansUploadStrings.error.courseCodeEmpty);

		// Regla 4: nombre de curso no vacío.
		if (courseName === '') errors.push(studyPlansUploadStrings.error.courseNameEmpty);

		// Regla 5: tipo de nivel — OPCIONAL (decisión 2026-05-29).
		// TODO(LEVEL_TYPE): PENDIENTE DEFINICIÓN DE NEGOCIO. No existe catálogo de niveles de curso migrado
		// (solo CHART_LEVEL_TYPE, que es del organigrama). Se acepta opcional para no bloquear D1: si el nivel
		// no se reconoce, se inserta null. Cuando negocio defina los codes de LEVEL_TYPE, reactivar la validación:
		//   if (levelTypeId === undefined) errors.push(studyPlansUploadStrings.error.levelTypeInvalid);

		// Regla 6: cada prerrequisito debe existir (en BD o en este lote).
		for (const p of prerequisites) {
			if (!lookups.existingCourseIdByCode.has(p.toLowerCase()) && !lookups.rowCourseCodes.has(p)) {
				errors.push(studyPlansUploadStrings.error.prerequisiteNotFound);
				break; // un solo mensaje por fila para no inflar el Excel-de-errores
			}
		}

		// Regla 7: dedup curso×malla.
		if (studyPlanCode !== '' && courseCode !== '' && lookups.existingSpcCodes.has(`${studyPlanCode}|${courseCode}`)) {
			errors.push(studyPlansUploadStrings.error.courseAlreadyInStudyPlan);
		}

		return {
			rowNumber: row.rowNumber,
			errors,
			studyPlanCode,
			studyPlanName,
			programId,
			courseCode,
			courseName,
			levelTypeId,
			prerequisites,
		};
	}

	static validateAll(rows: StudyPlanRow[], lookups: StudyPlansLookups): ResolvedStudyPlanRow[] {
		return rows.map((row) => this.validateRow(row, lookups));
	}
}
