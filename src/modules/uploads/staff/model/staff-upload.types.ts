import type { I18nText } from 'src/shared/types/i18n';

export interface StaffRow {
	rowNumber: number;
	email: string;
	positionTypeCode: string;
	jobTitle: I18nText;
	professorCode: string;
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
