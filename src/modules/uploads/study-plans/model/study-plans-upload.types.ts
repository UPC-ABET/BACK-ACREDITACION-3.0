import type { I18nText } from 'src/shared/types/i18n';

export interface StudyPlanRow {
	rowNumber: number;
	studyPlanCode: string;
	studyPlanName: I18nText;
	programCode: string;
	levelTypeCode: string;
	courseCode: string;
	courseName: I18nText;
	learningOutcome: I18nText;
	isElective: boolean;
}

export interface UploadRowError {
	rowNumber: number;
	errorCode: string;
}

export interface UploadResult {
	success: boolean;
	message: string | null;
	uploadLogId: number | null;
	totalRows: number;
	loadedRows: number;
	errorRows: number;
	excelWithErrors: string | null;
	fileName: string | null;
}

export function parseElective(value: string): boolean {
	return (value ?? '').trim() !== '';
}
