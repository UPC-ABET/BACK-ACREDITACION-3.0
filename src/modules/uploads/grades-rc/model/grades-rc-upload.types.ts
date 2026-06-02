export interface GradesRcRow {
	rowNumber: number;
	sectionCode: string;
	studentCode: string;
	gradeTypeCode: string;
	gradeTypePercentage: string;
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
