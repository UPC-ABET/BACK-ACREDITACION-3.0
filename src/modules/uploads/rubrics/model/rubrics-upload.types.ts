export interface RubricRow {
	rowNumber: number;
	courseCode: string;
	programCode: string;
	gradeTypeCode: string;
	outcomeCode: string;
	questionEs: string;
	questionEn: string;
	criteriaEs: string;
	criteriaEn: string;
	minValue: string;
	maxValue: string;
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
