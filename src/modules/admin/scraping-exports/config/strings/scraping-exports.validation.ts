export const scrapingExportsValidationStrings = {
	error: {
		notGenerated: 'error.scrapingExports.notGenerated',
		alreadyGenerating: 'error.scrapingExports.alreadyGenerating',
		generationFailed: 'error.scrapingExports.generationFailed',
		staleGenerationDetected: 'error.scrapingExports.staleGenerationDetected',
		invalidExportType: 'error.scrapingExports.invalidExportType',
		periodNotFound: 'error.scrapingExports.periodNotFound',
		// Distinct from `alreadyGenerating`: that key means "this exact export/period/lang is
		// already running." This one means the system-wide Grades RC merge slot is held by a
		// *different* period's generation — only one merge runs at a time because it pins a pooled
		// Postgres connection for minutes. Surfaced as this row's errorMessage when the auto-trigger
		// path (no caller to hand a 409 to) finds the slot taken.
		gradesRcBusy: 'error.scrapingExports.gradesRcBusy',
	},
};
