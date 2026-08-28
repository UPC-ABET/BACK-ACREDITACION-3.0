// Row shapes produced by the scraping-export queries. Each one is built to line up, column for
// column, with the matching uploads/* Excel template so a generated file can be re-uploaded as-is.

// The five generated exports. A plain string union mirroring `ScrapeRunEntity.status`'s own
// precedent rather than a `core.types` row, since adding an export type already requires a new
// generator method in code, not just seed data.
export type ScrapingExportType =
	| 'staff'
	| 'sections'
	| 'enrolledStudents'
	| 'studentSections'
	| 'gradesRc';

// Lifecycle of one `ScrapingExportRunEntity` row for a given (exportType, period) key. No
// 'pending' state: "no row yet" is represented separately as `{ status: 'notGenerated' }` (see
// ScrapingExportStatusResponse below), not by a status value on a persisted row.
export type ScrapingExportGenerationStatus = 'running' | 'completed' | 'failed';

// What `status`/`regenerate` hand back to a caller: the row's metadata, never `rowsData` — a
// language-neutral row array with no meaning to a status poller, and potentially large. `download`
// is the only endpoint that renders and streams an actual file, so there is no `lang` here — but
// `fileName` stays as a readiness signal (a caller gates its download action on `fileName !==
// null`): it is always the default-language name (`getDefaultExportFileName`), non-null exactly
// when `status === 'completed'`, regardless of which `lang` a later `download` call will actually
// render. See ADR-003.
export interface ScrapingExportStatusResponse {
	exportType: ScrapingExportType;
	period: string;
	status: ScrapingExportGenerationStatus | 'notGenerated';
	fileName: string | null;
	errorMessage: string | null;
	startedAt: Date | null;
	finishedAt: Date | null;
}

// Shared page size for every keyset-paginated read/write over gradesRc rows: the merge's own TEMP-
// table page read, the child-table batch insert, and the child-table page read back out for
// rendering. One constant keeps all three call sites moving together instead of drifting apart.
export const GRADES_RC_PAGE_SIZE = 5000;

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
	// gradeTypeInvalid and enrollmentNotFound: sectionNotFound and studentNotFound are already covered
	// by GRADES_RC_SQL's hard scope filters.
	UNREGISTERED_GRADE_TYPE: 'unregisteredGradeType',
	// Matriculated for the period, but not paired to THIS section (student_section_enrollments).
	STUDENT_NOT_IN_SECTION: 'studentNotInSection',
} as const;

// uploads/staff template: professorCode | lastName | firstName. professorCode is the Banner
// idBanner ("N0…"). The `email` column is appended as an extra (the staff upload reads positionally
// and ignores it); it is the real institutional email from the same raw_horario docente record.
export interface StaffExportRow {
	professorCode: string;
	lastName: string;
	firstName: string;
	email: string;
}

// uploads/sections template: courseCode | sectionCode | professorCode | campusCode |
// sectionModalityTypeCode. All sourced straight from Banner's raw_horario: campusCode is the mapped
// Banner campus code and sectionModalityTypeCode is Banner's metodoEducativo (defaulting to "P" when
// missing).
export interface SectionExportRow {
	courseCode: string;
	sectionCode: string;
	professorCode: string;
	campusCode: string;
	sectionModalityTypeCode: string;
}

// uploads/enrolled-students template: studentCode | lastName | firstName | programCode |
// campusCode | enrollmentModalityTypeCode. programCode is the mapped career code; enrollment
// modality is hardcoded to "P" for now (Banner's student payload carries no per-enrollment modality).
export interface EnrolledStudentExportRow {
	studentCode: string;
	lastName: string;
	firstName: string;
	programCode: string;
	campusCode: string;
	enrollmentModalityTypeCode: string;
}

// uploads/student-sections template: sectionCode | studentCode.
export interface StudentSectionExportRow {
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
