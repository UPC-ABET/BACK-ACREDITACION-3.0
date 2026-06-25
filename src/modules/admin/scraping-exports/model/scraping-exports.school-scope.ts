// Per-school scope for the exports. The scraper brings every department/career; when an active
// school is selected (X-School-Id header) the export is narrowed to that school, the way the
// original system did it per-school database.
//
//  - `departments` are Banner department codes (raw_horario.departamento) used to scope
//    secciones/docentes. The course-code prefix encodes the same department (e.g. "1A**SI**0728").
//  - `bannerPrograms` are Banner program codes (raw_alumno.programa.codigo / raw_matricula) used to
//    scope matriculados/alumno-sección by career.
//
// Validated against the original system's EISCC files (deps SI+CC → ~159 docentes; careers SW+CC →
// ~3000 matriculados). The other schools follow the same naming-based derivation and can be tuned
// here. Note: SI is shared by EISCC (software) and EISCB (information systems) because Banner has no
// separate "software" department — department filtering cannot split them.

export interface SchoolScope {
	departments: string[];
	bannerPrograms: string[];
}

// Keyed by organization.schools.code.
export const SCHOOL_SCOPE_BY_CODE: Record<string, SchoolScope> = {
	// Ingeniería de Software y Ciencias de la Computación
	EISCC: { departments: ['SI', 'CC'], bannerPrograms: ['UAC_ISOF_SP1', 'UAC_COMP_SP1'] },
	// Ingeniería de Sistemas de Información y Ciberseguridad
	EISCB: { departments: ['SI', 'CB'], bannerPrograms: ['UAC_ISIN_SP1', 'UAC_ICIB_SP1'] },
	// Ingeniería Civil
	'ING-CIV': { departments: ['CI'], bannerPrograms: ['UAC_ICIV_SP1'] },
	// Ingeniería Industrial
	'ING-IND': { departments: ['IN'], bannerPrograms: ['UAC_IIND_SP1'] },
	// Electrónica, Mecatrónica y Redes
	ESCEL: { departments: ['EL', 'MC'], bannerPrograms: ['UAC_IELE_SP1', 'UAC_IMEC_SP1'] },
	// Ingeniería de Gestión Minera
	'ING-GMI': { departments: ['GM'], bannerPrograms: ['UAC_IGMI_SP1'] },
	// Ingeniería Ambiental
	'ING-AMB': { departments: ['IG'], bannerPrograms: ['UAC_IAMB_SP1'] },
	// Ingeniería Biomédica
	'ING-BIO': { departments: ['BO'], bannerPrograms: ['UAC_IBIM_SP1'] },
	// Ingeniería de Gestión Empresarial
	'ING-GEM': { departments: ['GE'], bannerPrograms: ['UAC_IGEM_SP1'] },
};

export function getSchoolScope(schoolCode: string | null | undefined): SchoolScope | null {
	if (!schoolCode) return null;
	return SCHOOL_SCOPE_BY_CODE[schoolCode.trim()] ?? null;
}
