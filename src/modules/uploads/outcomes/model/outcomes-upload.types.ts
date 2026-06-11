import type { I18nText } from 'src/shared/types/i18n';

export interface OutcomeRow {
	rowNumber: number;
	outcomeCode: string;
	outcomeName: I18nText;
	outcomeDescription: I18nText;
	commissionCode: string;
	programCode: string;
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
