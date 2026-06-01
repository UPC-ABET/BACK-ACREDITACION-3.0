export interface SectionRow {
	rowNumber: number;
	studyPlanCode: string;
	courseCode: string;
	campusCode: string;
	professorCode: string;
	sectionModalityTypeCode: string;
	sectionCode: string;
}

export interface UploadRowError {
	rowNumber: number;
	errorCode: string;
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
