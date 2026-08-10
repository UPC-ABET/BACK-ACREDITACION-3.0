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
// grade | qualificationStatusCode. Built from both scrapings (Banner raw_notas + Planner
// raw_planner_nota); grade/qualificationStatusCode are resolved from the raw grade text, and
// gradeTypeCode is a TG205 code or — for a grade rescued by the last-grade fallback — the raw
// scraped code (see GradesRcExportRepository).
// The trailing fields carry no upload meaning: they feed the descriptive second worksheet, which
// the RC bulk upload never parses (it reads worksheets[0] positionally).
export interface GradeRcExportRow {
	sectionCode: string;
	studentCode: string;
	gradeTypeCode: string;
	gradeTypePercentage: string;
	grade: string;
	qualificationStatusCode: string;
	academicPeriod: string;
	courseCode: string;
	courseName: string;
	studentName: string;
	gradeTypeName: string;
	qualificationStatusName: string;
	// False when the scraped section is not in academic.course_sections for the period. Those rows
	// are kept out of the upload sheet (one unknown section makes the RC upload reject the whole
	// file) and surface in the descriptive sheet so the gap is visible.
	// Which scrape the exported grade came from, and when it was captured. Both sources have to be
	// scraped before exporting; these make it visible when one of them is stale.
	source: string;
	scrapedAt: string;
	// Observation codes (GRADE_RC_OBSERVATIONS) explaining why a row needs a look: grade rescued by
	// the fallback, missing designated grade, unexplained zero. Resolved to localized text by the
	// service and shown only in the descriptive sheet.
	observations: string[];
}
