import type { I18nText } from 'src/shared/types/i18n';

export interface ChartRow {
	rowNumber: number;
	code: string;
	parentCode: string;
	levelTypeCode: string;
	title: I18nText;
	email: string;
	entityTypeCode: string;
	entityCode: string;
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
