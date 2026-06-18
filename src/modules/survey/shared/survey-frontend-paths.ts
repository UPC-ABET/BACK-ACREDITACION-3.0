export const SURVEY_FRONTEND_PATHS = {
	// Both survey types use the unified panel — the backend now returns LCFC + GRA
	// surveys in the same list for any token, regardless of survey type.
	GRA: '/survey/lcfc/respond',
	LCFC: '/survey/lcfc/respond',
} as const;
