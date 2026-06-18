import type { I18nText } from 'src/shared/types/i18n';
import type { ReportLanguage } from './report.types';

export function escapeHtml(value: unknown): string {
	if (value === null || value === undefined) return '';

	return String(value).replace(/[<>&"']/g, (character) => {
		const entities: Record<string, string> = {
			'<': '&lt;',
			'>': '&gt;',
			'&': '&amp;',
			'"': '&quot;',
			"'": '&#39;',
		};
		return entities[character];
	});
}

export function localize(value: I18nText | null | undefined, language: ReportLanguage): string {
	return value?.[language] ?? value?.es ?? value?.en ?? '';
}

export function sanitizeReportFilename(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9._-]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
}
