// Planner (u-planner) token session, persisted to the token store file. Unlike Banner, Planner
// has no manual "stopper" and no refresh path — an expired access token is replaced by a fresh
// two-call login.
// `readonly` because one instance is shared: concurrent callers of `getValidSession` all receive
// the object the single flight resolved with, so an in-place edit anywhere would rewrite the token
// every other caller is using.
export interface PlannerTokenSession {
	readonly userId: number;
	readonly accessToken: string;
	readonly accessTokenExpiresAt: string; // ISO

	/**
	 * Kept for diagnostics only — nothing renews with it, deliberately (see PlannerTokenService).
	 * Optional so a change in u-planner's response cannot fail a login over a field we do not use.
	 */
	readonly refreshToken?: string;
	readonly refreshTokenExpiresAt?: string | null; // ISO
}

/**
 * `not_configured` means no credentials have ever been stored for Planner — a different problem
 * from a lapsed token, and the one the UI must answer with a setup form rather than a retry.
 *
 * The array is the source of truth for both the union and the Swagger `enum:`, so a new value
 * cannot reach one and miss the other.
 */
export const PLANNER_SESSION_STATUSES = [
	'active',
	'expiring',
	'expired',
	'not_configured',
] as const;

export type PlannerSessionStatus = (typeof PLANNER_SESSION_STATUSES)[number];
