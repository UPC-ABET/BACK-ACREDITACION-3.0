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

/**
 * Largest font size (pt) at which `text` still fits on a single line of `availableWidthPt`.
 * Arial has no metrics available at HTML-build time, so width is approximated as
 * `characters x glyphRatio x fontSize` — glyphRatio is the average advance width of the
 * typeface as a fraction of its em, measured for mixed-case (~0.55) and uppercase (~0.6) text.
 */
export function fitFontSizePt(
	text: string,
	availableWidthPt: number,
	options: { maxFontSizePt: number; minFontSizePt: number; glyphRatio: number },
): number {
	const characters = text.trim().length;
	if (characters === 0) return options.maxFontSizePt;

	const fitted = availableWidthPt / (characters * options.glyphRatio);
	const clamped = Math.min(options.maxFontSizePt, Math.max(options.minFontSizePt, fitted));
	return Math.floor(clamped * 10) / 10;
}

export function sanitizeReportFilename(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9._-]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
}
