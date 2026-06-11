export interface SectionRow {
	rowNumber: number;
	courseCode: string;
	sectionCode: string;
	professorCode: string;
	campusCode: string;
	sectionModalityTypeCode: string;
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
