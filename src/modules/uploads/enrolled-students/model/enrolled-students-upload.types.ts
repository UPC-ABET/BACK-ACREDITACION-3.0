export interface EnrolledStudentRow {
	rowNumber: number;
	studentCode: string;
	lastName: string;
	firstName: string;
	programCode: string;
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
