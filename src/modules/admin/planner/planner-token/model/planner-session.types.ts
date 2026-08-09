// Planner (u-planner) token session, persisted to the token store file. Unlike Banner, Planner
// has no manual "stopper" and no refresh path — an expired access token is replaced by a fresh
// two-call login. See PlannerTokenService for why the refresh branch was removed.
export interface PlannerTokenSession {
	userId: number;
	accessToken: string;
	accessTokenExpiresAt: string; // ISO

	/**
	 * Kept for diagnostics only — nothing renews with it, deliberately (see PlannerTokenService).
	 * Optional so a change in u-planner's response cannot fail a login over a field we do not use.
	 */
	refreshToken?: string;
	refreshTokenExpiresAt?: string | null; // ISO
}

/**
 * `not_configured` means no credentials have ever been stored for Planner — a different problem
 * from a lapsed token, and the one the UI must answer with a setup form rather than a retry.
 *
 * The values are the source of truth so the Swagger `enum:` array cannot drift from the union —
 * adding `not_configured` originally had to be remembered in two places.
 */
export const PLANNER_SESSION_STATUSES = [
	'active',
	'expiring',
	'expired',
	'not_configured',
] as const;

export type PlannerSessionStatus = (typeof PLANNER_SESSION_STATUSES)[number];
