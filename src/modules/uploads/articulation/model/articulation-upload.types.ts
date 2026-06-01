export interface ArticulationRow {
	rowNumber: number;
	outcomeCode: string;
	studyPlanCode: string;
	courseCode: string;
	outcomeTypeCode: string;
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
