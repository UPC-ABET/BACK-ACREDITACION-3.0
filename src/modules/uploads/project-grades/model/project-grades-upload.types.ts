export const MAX_QUESTION_SLOTS = 5;
export const MAX_CRITERIA_SLOTS = 5;

/** Modo B — everything except Capstone + Multiple competency. One row per student. */
export interface ProjectGradeRowB {
	rowNumber: number;
	competencyScopeCode: string;
	gradeTypeCode: string;
	academicPeriodCode: string;
	projectCode: string;
	studentCode: string;
	evaluatorCode: string;
	statusCode: string;
	questions: string[]; // length MAX_QUESTION_SLOTS, blank slots allowed
	observationEs: string;
	observationEn: string;
}

/** Modo A — Capstone + Multiple competency. One row per (student, outcome); several rows per
 * student are grouped together to build a single evaluation. */
export interface ProjectGradeRowA {
	rowNumber: number;
	gradeTypeCode: string;
	academicPeriodCode: string;
	projectCode: string;
	studentCode: string;
	evaluatorCode: string;
	statusCode: string;
	outcomeCode: string;
	criterias: string[]; // length MAX_CRITERIA_SLOTS, blank slots allowed
	observationEs: string;
	observationEn: string;
}

export type UploadSheet = 'B' | 'A';

export interface UploadRowError {
	sheet: UploadSheet;
	rowNumber: number;
	errorCodes: string[];
}

export interface UploadResult {
	success: boolean;
	uploadLogId: number | null;
	totalRows: number;
	loadedRows: number;
	errorRows: number;
	excelWithErrors: string | null;
	fileName: string | null;
}
