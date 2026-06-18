export interface ProjectRow {
	rowNumber: number;
	projectCode: string;
	projectNameEs: string;
	projectNameEn: string;
	courseCode: string;
	studentCode: string;
	/** Comma-separated professor codes keyed by evaluator type code (e.g. 'TG403-T001') */
	evaluators: Record<string, string>;
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
