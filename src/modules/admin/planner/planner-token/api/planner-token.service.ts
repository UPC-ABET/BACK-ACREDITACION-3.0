import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { BadRequestError } from 'src/commons/domain-error';
import { ScraperCredentialService } from 'src/modules/admin/scraping/credentials/api/scraper-credentials.service';
import { SCRAPER_PROVIDER_CODES } from 'src/modules/admin/scraping/credentials/constants/scraper-provider-codes';
import { PlannerLoginClient } from '../core/planner-login.client';
import { PlannerSessionStore } from '../core/planner-session.store';
import {
	PlannerLoginUnreachableError,
	PlannerSessionExpiredError,
} from '../model/session-expired.error';
import { plannerSessionValidationStrings } from '../config/strings/planner-session.validation';
import { PlannerSessionStatus, PlannerTokenSession } from '../model/planner-session.types';

const REFRESH_SKEW_MS = 60_000;
// Back off after a failed login so a repeated "Try to refresh" press does not hammer u-planner.
const REFRESH_COOLDOWN_MS = 30_000;
const EXPIRING_WINDOW_MS = 30 * 60_000;

/** Why the last refresh failed. The cooldown replays the same answer, so it has to remember. */
interface RefreshFailure {
	atMs: number;
	unreachable: boolean;
}

/**
 * Planner (u-planner) token management, the Planner analogue of {@link BannerTokenService}.
 *
 * Banner needs a manual browser login (the "stopper") streamed over noVNC because of 2FA.
 * Planner does not: the operator credentials are stored encrypted and submitted to u-planner's
 * own HTTP API. There is deliberately **no refresh-token path** — an expired access token is
 * replaced by a fresh two-call login, because a refresh branch can silently wedge a session that
 * no amount of retrying recovers.
 */
@Injectable()
export class PlannerTokenService {
	private readonly logger = new Logger(PlannerTokenService.name);
	private refreshing: Promise<PlannerTokenSession> | null = null;
	private refreshingIsForced = false;
	private lastFailure: RefreshFailure | null = null;
	private sessionGeneration = 0;

	constructor(
		private readonly store: PlannerSessionStore,
		private readonly loginClient: PlannerLoginClient,
		private readonly credentials: ScraperCredentialService,
	) {}

	// The Planner API requires `user=<userId>` on every request, so callers need the whole session
	// rather than just the token.
	async getValidSession(forceRefresh = false): Promise<PlannerTokenSession> {
		return await this.ensureSession(forceRefresh);
	}

	async getValidToken(forceRefresh = false): Promise<string> {
		return (await this.getValidSession(forceRefresh)).accessToken;
	}

	async getStatus(): Promise<{ status: PlannerSessionStatus; tokenExp: string | null }> {
		// Credentials first: an orphaned store file must not make an unconfigured system look active.
		if (!(await this.credentials.isConfigured(SCRAPER_PROVIDER_CODES.PLANNER))) {
			return { status: 'not_configured', tokenExp: null };
		}

		const session = this.store.read();
		if (!session) return { status: 'expired', tokenExp: null };

		const accessRemaining = this.remaining(session.accessTokenExpiresAt);

		if (accessRemaining > EXPIRING_WINDOW_MS) {
			return { status: 'active', tokenExp: session.accessTokenExpiresAt };
		}
		if (accessRemaining > 0) {
			return { status: 'expiring', tokenExp: session.accessTokenExpiresAt };
		}
		return { status: 'expired', tokenExp: session.accessTokenExpiresAt };
	}

	/**
	 * Always contacts u-planner, except while the post-failure cooldown is armed.
	 *
	 * The result describes **the refresh attempt**, not the file on disk, and the two failure kinds
	 * are not interchangeable. A *refused* login disproves the stored session however much life its
	 * `exp` claims, so it reports `expired`. An *unreachable* u-planner disproves nothing — the
	 * stored token may be good for hours and the scraper will keep using it — so it surfaces as
	 * `503`, matching what the credential-save path already does for the same failure.
	 */
	async refresh(): Promise<{ status: PlannerSessionStatus; tokenExp: string | null }> {
		if (!(await this.credentials.isConfigured(SCRAPER_PROVIDER_CODES.PLANNER))) {
			throw new BadRequestError(plannerSessionValidationStrings.error.credentialsNotConfigured);
		}

		const cooling = this.coolingDown();
		if (cooling) {
			const waitMs = REFRESH_COOLDOWN_MS - (Date.now() - cooling.atMs);
			this.logger.debug(`Planner refresh short-circuited by the cooldown; ${waitMs}ms remaining`);
			return this.reportFailure(cooling);
		}

		try {
			// Forced: the failure this exists to clear is an access token that has not expired but is
			// already rejected server-side, which the cached fast path would report as healthy.
			await this.ensureSession(true);
		} catch (error) {
			if (error instanceof PlannerSessionExpiredError) {
				const failure: RefreshFailure = {
					atMs: Date.now(),
					unreachable: error instanceof PlannerLoginUnreachableError,
				};
				this.lastFailure = failure;
				return this.reportFailure(failure);
			}
			throw error;
		}
		return await this.getStatus();
	}

	private coolingDown(): RefreshFailure | null {
		if (this.lastFailure && Date.now() - this.lastFailure.atMs < REFRESH_COOLDOWN_MS) {
			return this.lastFailure;
		}
		return null;
	}

	/** Never returns for an unreachable host — it throws, so the caller sees 503, not `expired`. */
	private reportFailure(failure: RefreshFailure): {
		status: PlannerSessionStatus;
		tokenExp: string | null;
	} {
		if (failure.unreachable) {
			throw new ServiceUnavailableException(plannerSessionValidationStrings.error.unreachable);
		}
		return { status: 'expired', tokenExp: this.store.read()?.accessTokenExpiresAt ?? null };
	}

	/**
	 * Single-flight: concurrent callers share one login.
	 *
	 * A forced caller may only join a flight that is itself forced. Sharing a non-forced flight
	 * would hand it the cached session it is trying to replace — and the scraper's one-shot 401
	 * retry is a forced call, so that would re-send the rejected token and abort the whole run.
	 */
	private ensureSession(forceRefresh: boolean): Promise<PlannerTokenSession> {
		if (this.refreshing && (!forceRefresh || this.refreshingIsForced)) return this.refreshing;

		// What this caller wants replaced. If the flight it queues behind replaces it first, there
		// is nothing left to force — see afterCurrentFlight.
		const supersededToken = forceRefresh ? (this.store.read()?.accessToken ?? null) : null;
		const flight = this.afterCurrentFlight(this.refreshing, forceRefresh, supersededToken);
		this.refreshing = flight;
		this.refreshingIsForced = forceRefresh;

		// Attached immediately so the reset runs before any caller's continuation.
		void flight
			.finally(() => {
				if (this.refreshing === flight) {
					this.refreshing = null;
					this.refreshingIsForced = false;
				}
			})
			.catch(() => undefined);

		return flight;
	}

	private async afterCurrentFlight(
		previous: Promise<PlannerTokenSession> | null,
		forceRefresh: boolean,
		supersededToken: string | null,
	): Promise<PlannerTokenSession> {
		if (!previous) return await this.resolveSession(forceRefresh);

		await previous.catch(() => undefined);

		// The predecessor may already have replaced what this caller wanted gone. Re-logging in
		// would double the wall clock and, worse, would hand its own failure to every non-forced
		// caller that has since joined this flight — even though a good session is now on disk.
		const current = this.store.read();
		if (
			current &&
			current.accessToken !== supersededToken &&
			this.remaining(current.accessTokenExpiresAt) > REFRESH_SKEW_MS
		) {
			return current;
		}

		return await this.resolveSession(forceRefresh);
	}

	private async resolveSession(forceRefresh: boolean): Promise<PlannerTokenSession> {
		const existing = this.store.read();
		if (
			existing &&
			!forceRefresh &&
			this.remaining(existing.accessTokenExpiresAt) > REFRESH_SKEW_MS
		) {
			return existing;
		}
		return await this.login();
	}

	/**
	 * Adopt a session obtained elsewhere — the credential-save path logs in directly so it can
	 * verify before persisting. Routing that write here keeps one writer for the store, and clears
	 * the cooldown, which a fresh session has just made obsolete.
	 *
	 * Bumping the generation is what lets a login already in flight under the previous credentials
	 * recognise that its result is stale and decline to overwrite this one.
	 */
	adoptSession(session: PlannerTokenSession): void {
		this.sessionGeneration += 1;
		this.store.save(session);
		this.lastFailure = null;
	}

	private async login(): Promise<PlannerTokenSession> {
		const generation = this.sessionGeneration;

		try {
			const credential = await this.credentials.getDecrypted(SCRAPER_PROVIDER_CODES.PLANNER);
			if (!credential) {
				throw new PlannerSessionExpiredError('Planner credentials are not configured');
			}

			const session = await this.loginClient.login(credential.username, credential.password);

			if (generation !== this.sessionGeneration) {
				// The credentials changed while this login was in flight. The session is valid, so
				// return it to the caller that is waiting, but it belongs to the superseded account
				// and must not replace what was stored in the meantime.
				this.logger.warn('Planner login superseded by a credential change; session not stored');
				return session;
			}

			this.adoptSession(session);
			return session;
		} catch (error) {
			// Logged here rather than in refresh() so that scrape-time failures — which reach this
			// through getValidSession() and never touch refresh() — are not silent.
			if (error instanceof PlannerSessionExpiredError) {
				this.logger.warn(`Planner login failed - ${error.name}: ${error.message}`);
			}
			throw error;
		}
	}

	private remaining(isoExpiry: string | null): number {
		if (!isoExpiry) return 0;
		const ms = new Date(isoExpiry).getTime();
		return Number.isFinite(ms) ? ms - Date.now() : 0;
	}
}
