import type { I18nText } from 'src/shared/types/i18n';

export interface UserSchool {
	id: number;
	code: string;
	name: I18nText;
	facultyId: number;
	facultyCode: string | null;
	facultyName: I18nText | null;
}
