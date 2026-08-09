export const SCRAPER_PROVIDER_CODES = {
	PLANNER: 'PLANNER',
	BANNER: 'BANNER',
} as const;

export type ScraperProviderCode =
	(typeof SCRAPER_PROVIDER_CODES)[keyof typeof SCRAPER_PROVIDER_CODES];

export const SCRAPER_PROVIDER_CODE_VALUES = Object.values(
	SCRAPER_PROVIDER_CODES,
) as ScraperProviderCode[];
