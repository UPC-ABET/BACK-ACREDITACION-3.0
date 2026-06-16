// Planner (u-planner) token session, persisted to the token store file. Unlike Banner,
// Planner has no manual "stopper": the operator's username/password are submitted and the
// login is driven automatically; an expired access token is refreshed via the validate API
// without a new browser login.
export interface PlannerTokenSession {
	userId: number;
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresAt: string; // ISO
	refreshTokenExpiresAt: string; // ISO
}

export type PlannerSessionStatus = 'active' | 'expiring' | 'expired';
