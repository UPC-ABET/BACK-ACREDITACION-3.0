export interface GradesRvRow {
	rowNumber: number;
	sectionCode: string;
	studentCode: string;
	outcomeCode: string;
	grade: string;
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

export interface UploadRowError {
	rowNumber: number;
	errorCode: string;
}
