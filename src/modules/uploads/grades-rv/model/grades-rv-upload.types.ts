export interface GradesRvRow {
	rowNumber: number;
	schoolCode: string; // col 1
	programCode: string; // col 2
	commissionCode: string; // col 3
	courseCode: string; // col 4
	studentCode: string; // col 5
	sectionCode: string; // col 6
	professorCode: string; // col 7
	gradeTypeCode: string; // col 8
	o1: string; // col 9
	o2: string; // col 10
	o3: string; // col 11
	o4: string; // col 12
	o5: string; // col 13
	o6: string; // col 14
	o7: string; // col 15
	projectCode: string; // col 16
	projectNameEs: string; // col 17
	projectNameEn: string; // col 18  (optional; defaults to "-" if blank)
	projectDescEs: string; // col 19  (optional)
	projectDescEn: string; // col 20  (optional)
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
