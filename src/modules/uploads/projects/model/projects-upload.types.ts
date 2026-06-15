export interface ProjectRow {
	rowNumber: number;
	projectCode: string;
	projectNameEs: string;
	projectNameEn: string;
	courseCode: string;
	studentCode: string;
	sectionCode: string;
	professorCode: string;
	evaluatorTypeCode: string;
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
