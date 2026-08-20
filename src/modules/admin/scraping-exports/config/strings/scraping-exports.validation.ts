// Keys use the singular `scrapingExport` module segment, matching every other module's i18n
// convention in this codebase (e.g. `error.course.*`, `error.studyPlanAcademicPeriod.*`) — the
// object below stays named `scrapingExportsValidationStrings` to match the module/file name, but
// the key *strings* follow the codebase-wide singular convention (AF-7).
export const scrapingExportsValidationStrings = {
	error: {
		notGenerated: 'error.scrapingExport.notGenerated',
		alreadyGenerating: 'error.scrapingExport.alreadyGenerating',
		generationFailed: 'error.scrapingExport.generationFailed',
		staleGenerationDetected: 'error.scrapingExport.staleGenerationDetected',
		invalidExportType: 'error.scrapingExport.invalidExportType',
		periodNotFound: 'error.scrapingExport.periodNotFound',
		// Distinct from `alreadyGenerating`: that key means "this exact export/period/lang is
		// already running." This one means the system-wide Grades RC merge slot is held by a
		// *different* period's generation — only one merge runs at a time because it pins a pooled
		// Postgres connection for minutes. Surfaced as this row's errorMessage when the auto-trigger
		// path (no caller to hand a 409 to) finds the slot taken.
		gradesRcBusy: 'error.scrapingExport.gradesRcBusy',
	},
};
