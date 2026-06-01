export interface EnrolledStudentRow {
	rowNumber: number;
	studentCode: string;
	email: string;
	programCode: string;
	studyPlanCode: string;
	campusCode: string;
	enrollmentModalityTypeCode: string;
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
