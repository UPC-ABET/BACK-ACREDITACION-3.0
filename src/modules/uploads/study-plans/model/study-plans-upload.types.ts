import type { I18nText } from 'src/shared/types/i18n';

export interface StudyPlanRow {
	rowNumber: number;
	studyPlanCode: string;
	studyPlanName: I18nText;
	programCode: string;
	level: string;
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
	uploadLogId: number | null;
	totalRows: number;
	loadedRows: number;
	errorRows: number;
	excelWithErrors: string | null;
	fileName: string | null;
}

const ELECTIVE_TRUE_VALUES = new Set(['SI', 'SÍ', 'YES', 'Y', 'TRUE']);

export function parseElective(value: string): boolean {
	return ELECTIVE_TRUE_VALUES.has((value ?? '').trim().toUpperCase());
}
