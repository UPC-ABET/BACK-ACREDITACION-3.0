// Shared frontend-facing i18n keys for upload operation failures (HTTP error responses). They use
// the `error.*` namespace so AllExceptionsFilter forwards them to the client (other namespaces are
// suppressed to a generic status key). The PG short codes and per-row Excel codes are separate.
export const uploadLogsValidationStrings = {
	error: {
		periodNotFound: 'error.uploads.periodNotFound',
		chartsAlreadyLoadedForPeriod: 'error.uploads.chartsAlreadyLoadedForPeriod',
		uploadLogNotFound: 'error.uploads.uploadLogNotFound',
		rollbackAlreadyDone: 'error.uploads.rollbackAlreadyDone',
		typeCodeNotFound: 'error.uploads.typeCodeNotFound',
		rollbackBlockedSections: 'error.uploads.rollbackBlockedSections',
		rollbackBlockedOutcomes: 'error.uploads.rollbackBlockedOutcomes',
		rollbackBlockedProfessors: 'error.uploads.rollbackBlockedProfessors',
		rollbackBlockedStaff: 'error.uploads.rollbackBlockedStaff',
		rollbackBlockedNewerUpload: 'error.uploads.rollbackBlockedNewerUpload',
	},
} as const;
