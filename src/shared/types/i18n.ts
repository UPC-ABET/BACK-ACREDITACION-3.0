export type I18nText = Record<string, string>;

export const toI18n = (text: I18nText | string): I18nText => {
	if (typeof text === 'string') return { es: text, en: text };
	return text;
};

export const i18nText = (val: I18nText | string | null | undefined): I18nText | null => {
	if (!val) return null;
	if (typeof val === 'string') return toI18n(val);
	return val;
};

export const i18nTrim = (val: I18nText | null | undefined): string | null => {
	if (!val) return null;
	const text = typeof val === 'string' ? val : (val.es ?? Object.values(val)[0] ?? '');
	return text.trim();
};
