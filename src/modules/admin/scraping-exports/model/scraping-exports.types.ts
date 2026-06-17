// Row shapes produced by the scraping-export queries. Each one is built to line up, column for
// column, with the matching uploads/* Excel template so a generated file can be re-uploaded as-is.

// uploads/staff template: professorCode | lastName | firstName. The `email` column is appended as
// an extra (the staff upload reads positionally and ignores it); it is always reconstructable as
// `${professorCode}@upc.edu.pe`, which is exactly why staff stopped persisting it.
export interface DocenteExportRow {
	professorCode: string;
	lastName: string;
	firstName: string;
	email: string;
}

// uploads/sections template: courseCode | sectionCode | professorCode | campusCode |
// sectionModalityTypeCode. campus/modality are best-effort: enriched from Banner's horario when the
// Planner sectionName matches a Banner NRC, blank otherwise.
export interface SeccionExportRow {
	courseCode: string;
	sectionCode: string;
	professorCode: string;
	campusCode: string;
	sectionModalityTypeCode: string;
}

// uploads/enrolled-students template: studentCode | lastName | firstName | programCode |
// campusCode | enrollmentModalityTypeCode. Modality is left blank (Banner's student payload does
// not carry an enrollment modality; it is filled later if needed).
export interface AlumnoMatriculadoExportRow {
	studentCode: string;
	lastName: string;
	firstName: string;
	programCode: string;
	campusCode: string;
	enrollmentModalityTypeCode: string;
}

// uploads/student-sections template: sectionCode | studentCode.
export interface AlumnoSeccionExportRow {
	sectionCode: string;
	studentCode: string;
}
