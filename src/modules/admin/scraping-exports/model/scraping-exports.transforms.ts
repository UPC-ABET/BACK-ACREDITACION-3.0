// Value transformations that turn raw Banner codes into the codes the upload templates / original
// system expect. Kept in one place so docentes/secciones/matriculados stay consistent.

// Banner campus code -> short campus/local code used by the original system (CS, MO, SI, VL).
// San Miguel (both SMI and the "HUB – San Miguel" code) maps to CS.
const CAMPUS_MAP: Record<string, string> = {
	MON: 'MO',
	SIS: 'SI',
	VIL: 'VL',
	SMI: 'CS',
	HUB: 'CS',
};

export function mapCampus(bannerCampusCode: string | null | undefined): string {
	const code = (bannerCampusCode ?? '').trim().toUpperCase();
	return CAMPUS_MAP[code] ?? code;
}

// Banner program code -> academic.programs.code (the "career" code, e.g. SW / CC). The export only
// covers engineering programs (the accreditation scope), so any program not in this map returns
// null and the caller drops the row.
// NOTE: Civil and Industrial have two accreditation variants (FC/AC) in academic.programs; FC is
// used here as the default — pending confirmation.
const PROGRAM_CAREER_MAP: Record<string, string> = {
	UAC_ISOF_SP1: 'SW', // Ingeniería de Software
	UAC_COMP_SP1: 'CC', // Ciencias de la Computación
	UAC_ISIN_SP1: 'SI', // Ingeniería de Sistemas de Información
	UAC_IMEC_SP1: 'MEC', // Ingeniería Mecatrónica
	UAC_IGEM_SP1: 'IGE', // Ingeniería de Gestión Empresarial
	UAC_IAMB_SP1: 'IA', // Ingeniería Ambiental
	UAC_IBIM_SP1: 'BIO', // Ingeniería Biomédica
	UAC_IELE_SP1: 'ELE', // Ingeniería Electrónica
	UAC_ICIB_SP1: 'CB', // Ingeniería de Ciberseguridad
	UAC_IGMI_SP1: 'IGM', // Ingeniería de Gestión Minera
	UAC_ICIV_SP1: 'CIV FC', // Ingeniería Civil (FC/AC variants — confirm)
	UAC_IIND_SP1: 'IND FC', // Ingeniería Industrial (FC/AC variants — confirm)
};

// Returns the engineering career code, or null when the program is out of scope (non-engineering).
export function mapProgramToCareer(bannerProgramCode: string | null | undefined): string | null {
	const code = (bannerProgramCode ?? '').trim();
	return PROGRAM_CAREER_MAP[code] ?? null;
}

// Sections whose Banner modality is missing default to "P" (presencial), per the original system.
export const DEFAULT_SECTION_MODALITY = 'P';

// Enrollment "modality" column is not really known yet; the original system carries the enrollment
// state, which is "MRE" for every active row, so it is hardcoded for now.
export const DEFAULT_ENROLLMENT_STATUS = 'MRE';
