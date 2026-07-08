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
// Banner scrapes two modalities under different code prefixes and academic periods:
//   - UAC_* = regular careers (period 202610) -> the AC / plain codes.
//   - UFC_* = EPE careers    (period 202615) -> the FC / EPE codes (CIVFC, INDFC, IS, RED).
// The programCode column feeds the enrolled-students upload, which JOINs academic.programs on this
// code (all-or-nothing), so every value here must be a real academic.programs.code.
const PROGRAM_CAREER_MAP: Record<string, string> = {
	// --- Regular (UAC_) ---
	UAC_ISOF_SP1: 'SW', // Software Engineering
	UAC_COMP_SP1: 'CC', // Computer Science
	UAC_ISIN_SP1: 'SI', // Information Systems Engineering
	UAC_IMEC_SP1: 'MEC', // Mechatronics Engineering
	UAC_IGEM_SP1: 'IGE', // Business Management Engineering
	UAC_IAMB_SP1: 'IA', // Environmental Engineering
	UAC_IBIM_SP1: 'BIO', // Biomedical Engineering
	UAC_IELE_SP1: 'ELE', // Electronics Engineering
	UAC_ICIB_SP1: 'CB', // Cybersecurity Engineering
	UAC_IGMI_SP1: 'IGM', // Mining Management Engineering
	UAC_ICIV_SP1: 'CIVAC', // Civil Engineering (regular)
	UAC_IIND_SP1: 'INDAC', // Industrial Engineering (regular)
	UAC_INAR_SP1: 'IIA', // Artificial Intelligence Engineering
	// --- EPE (UFC_) ---
	UFC_INGC_SP1: 'CIVFC', // Civil Engineering EPE
	UFC_INGI_SP1: 'INDFC', // Industrial Engineering EPE
	UFC_INGS_SP1: 'IS', // Systems Engineering EPE
	UFC_INRC_SP1: 'RED', // Networks Engineering EPE
};

export function mapProgramToCareer(bannerProgramCode: string | null | undefined): string | null {
	const code = (bannerProgramCode ?? '').trim();
	return PROGRAM_CAREER_MAP[code] ?? null;
}

// Sections whose Banner modality is missing default to "P" (presencial), per the original system.
export const DEFAULT_SECTION_MODALITY = 'P';

// Enrollment "modality" column (P/V/S = presencial/virtual/semipresencial). There is no reliable
// per-enrollment source for it yet, so it is hardcoded to "P" for now (pending a real mapping).
export const DEFAULT_ENROLLMENT_STATUS = 'P';
