import { SectionRow, VALID_STUDY_TYPES } from '../model/sections-upload.types';
import { sectionsUploadStrings } from '../config/strings/sections-upload.validation';

// Lookups pre-cargados por el servicio con queries set-based (1 query por dimensión, no N+1).
export interface SectionsLookups {
	courseIdByCode: Map<string, number>; // academic.courses.code → id
	studyPlanCourseIdByCourseId: Map<number, number>; // course_id → study_plan_courses.id (en la malla del período)
	professorIdByCode: Map<string, number>; // docente code → academic.professors.id (vía organization.staff)
	campusIdByCode: Map<string, number>; // organization.campuses.code → id
	modalityTypeIdByStudyType: Map<string, number>; // 'P'|'V'|'S' → core type id
	existingSectionKeys: Set<string>; // `${studyPlanCourseId}|${campusId}|${sectionCode}` ya existentes
}

// Fila resuelta a ids — lista para INSERT cuando errors está vacío.
export interface ResolvedSectionRow {
	rowNumber: number;
	errors: string[];
	studyPlanCourseId?: number;
	professorId?: number;
	campusId?: number;
	sectionModalityTypeId?: number;
	sectionCode?: string;
}

// Réplica pura de Ciclo.FN_Valida_Secciones (las 6 reglas) + el mapeo de TipoEstudio.
// Pura a propósito: permite tests de regresión 1:1 contra el SP legacy (paridad de comportamiento).
export class SectionsUploadValidation {
	static validateRow(row: SectionRow, lookups: SectionsLookups): ResolvedSectionRow {
		const errors: string[] = [];

		const studyType = (row.studyType ?? '').trim().toUpperCase();
		const courseId = lookups.courseIdByCode.get(row.courseCode);
		const studyPlanCourseId = courseId !== undefined ? lookups.studyPlanCourseIdByCourseId.get(courseId) : undefined;
		const professorId = lookups.professorIdByCode.get(row.professorCode);
		const campusId = lookups.campusIdByCode.get(row.campusCode);
		const sectionModalityTypeId = lookups.modalityTypeIdByStudyType.get(studyType);

		// Regla 1: el curso debe existir en el sistema.
		if (courseId === undefined) errors.push(sectionsUploadStrings.error.courseNotFound);

		// Regla 2: el curso debe estar en la malla del período.
		if (courseId !== undefined && studyPlanCourseId === undefined) errors.push(sectionsUploadStrings.error.courseNotInStudyPlan);

		// Regla 3: el docente debe existir.
		if (professorId === undefined) errors.push(sectionsUploadStrings.error.professorNotFound);

		// Regla 4: la sede debe existir.
		if (campusId === undefined) errors.push(sectionsUploadStrings.error.campusNotFound);

		// Regla 5: el código de sección no puede estar vacío.
		if (!row.sectionCode || row.sectionCode.trim() === '') errors.push(sectionsUploadStrings.error.sectionCodeEmpty);

		// TipoEstudio: no vacío y dentro de {P, V, S}.
		if (studyType === '') errors.push(sectionsUploadStrings.error.studyTypeEmpty);
		else if (!VALID_STUDY_TYPES.includes(studyType)) errors.push(sectionsUploadStrings.error.studyTypeInvalid);

		// Regla 6: la sección no debe estar ya registrada (study_plan_course + campus + código).
		if (studyPlanCourseId !== undefined && campusId !== undefined && row.sectionCode) {
			const key = `${studyPlanCourseId}|${campusId}|${row.sectionCode.trim()}`;
			if (lookups.existingSectionKeys.has(key)) errors.push(sectionsUploadStrings.error.sectionAlreadyExists);
		}

		return {
			rowNumber: row.rowNumber,
			errors,
			studyPlanCourseId,
			professorId,
			campusId,
			sectionModalityTypeId,
			sectionCode: row.sectionCode?.trim(),
		};
	}

	static validateAll(rows: SectionRow[], lookups: SectionsLookups): ResolvedSectionRow[] {
		return rows.map((row) => this.validateRow(row, lookups));
	}
}
