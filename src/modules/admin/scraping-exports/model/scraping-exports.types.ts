// Row shapes produced by the scraping-export queries. Each one is built to line up, column for
// column, with the matching uploads/* Excel template so a generated file can be re-uploaded as-is.

// The five generated exports. A plain string union mirroring `ScrapeRunEntity.status`'s own
// precedent rather than a `core.types` row, since adding an export type already requires a new
// generator method in code, not just seed data.
export type ScrapingExportType =
	| 'docentes'
	| 'secciones'
	| 'alumnosMatriculados'
	| 'alumnosSecciones'
	| 'gradesRc';

// Lifecycle of one `ScrapingExportRunEntity` row for a given (exportType, periodo, lang) key.
// No 'pending' state: "no row yet" is represented separately as `{ status: 'notGenerated' }`
// (see ScrapingExportStatusResponse below), not by a status value on a persisted row.
export type ScrapingExportGenerationStatus = 'running' | 'completed' | 'failed';

// What `status`/`regenerate` hand back to a caller: the row's metadata, never `fileBytes` — that
// column can hold a multi-megabyte workbook, and JSON-serializing a Buffer blows it up further
// still (`{ type: 'Buffer', data: [...] }`). `download` is the only endpoint that ever streams the
// actual bytes.
export interface ScrapingExportStatusResponse {
	exportType: ScrapingExportType;
	periodo: string;
	lang: string;
	status: ScrapingExportGenerationStatus | 'notGenerated';
	fileName: string | null;
	errorMessage: string | null;
	startedAt: Date | null;
	finishedAt: Date | null;
}

// Codes emitted in the observations array of GradeRcExportRow, and the split between the two
// worksheets: a row carrying any of them goes to the descriptive sheet instead of the upload one.
// Declared in model so both the SQL and the labels depend downwards on the same constant.
export const GRADE_RC_OBSERVATIONS = {
	COURSE_LEVEL_STATUS: 'courseLevelStatus',
	MISSING_DESIGNATED_GRADE: 'missingDesignatedGrade',
	MISSING_DESIGNATED_GRADE_PENDING: 'missingDesignatedGradePending',
	MISSING_DESIGNATED_GRADE_UNEXPLAINED: 'missingDesignatedGradeUnexplained',
	FALLBACK_GRADE: 'fallbackGrade',
	ZERO_GRADE_UNEXPLAINED: 'zeroGradeUnexplained',
	UNREGISTERED_STATUS: 'unregisteredStatus',
	NO_SOURCE_GRADE_OR_STATUS: 'noSourceGradeOrStatus',
	// gradeTypeInvalid and studentNotFound/enrollmentNotFound: with sectionNotFound already covered
	// by the scope filter, these are the remaining reasons the upload refuses a whole file.
	UNREGISTERED_GRADE_TYPE: 'unregisteredGradeType',
	STUDENT_NOT_ENROLLED: 'studentNotEnrolled',
} as const;

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
	// Empty when the program is outside PROGRAM_CAREER_MAP or the student has no Banner record; the
	// row still ships either way.
	careerCode: string;
	gradeTypeName: string;
	qualificationStatusName: string;
	// Both sources have to be scraped before exporting; these make it visible when one is stale.
	source: string;
	scrapedAt: string;
	// GRADE_RC_OBSERVATIONS codes. A non-empty array sends the row to the descriptive sheet.
	observations: string[];
}
