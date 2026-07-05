// Row shapes produced by the scraping-export queries. Each one is built to line up, column for
// column, with the matching uploads/* Excel template so a generated file can be re-uploaded as-is.

// uploads/staff template: professorCode | lastName | firstName. professorCode is the Banner
// idBanner ("N0…"). The `email` column is appended as an extra (the staff upload reads positionally
// and ignores it); it is the real institutional email from the same raw_horario docente record.
export interface DocenteExportRow {
	professorCode: string;
	lastName: string;
	firstName: string;
	email: string;
}

// uploads/sections template: courseCode | sectionCode | professorCode | campusCode |
// sectionModalityTypeCode. All sourced straight from Banner's raw_horario: campusCode is the mapped
// Banner campus code and sectionModalityTypeCode is Banner's metodoEducativo (defaulting to "P" when
// missing).
export interface SeccionExportRow {
	courseCode: string;
	sectionCode: string;
	professorCode: string;
	campusCode: string;
	sectionModalityTypeCode: string;
}

// uploads/enrolled-students template: studentCode | lastName | firstName | programCode |
// campusCode | enrollmentModalityTypeCode. programCode is the mapped career code; enrollment
// modality is hardcoded to "P" for now (Banner's student payload carries no per-enrollment modality).
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

// uploads/grades-rc template: sectionCode | studentCode | gradeTypeCode | gradeTypePercentage |
// grade | qualificationStatusCode. Built from raw_notas (Banner); grade/qualificationStatusCode
// are resolved from the raw nota text (see NotasRcExportService).
export interface NotaRcExportRow {
	sectionCode: string;
	studentCode: string;
	gradeTypeCode: string;
	gradeTypePercentage: string;
	grade: string;
	qualificationStatusCode: string;
}
