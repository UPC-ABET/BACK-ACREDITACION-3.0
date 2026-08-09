import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { BadRequestError } from 'src/commons/domain-error';
import { ScraperCredentialService } from 'src/modules/admin/scraping/credentials/api/scraper-credentials.service';
import { SCRAPER_PROVIDER_CODES } from 'src/modules/admin/scraping/credentials/constants/scraper-provider-codes';
import { PLANNER_LOGIN_WORST_CASE_MS, PlannerLoginClient } from '../core/planner-login.client';
import { PlannerSessionStore } from '../core/planner-session.store';
import {
	isPlannerLoginError,
	PlannerLoginUnreachableError,
	PlannerSessionExpiredError,
} from '../model/session-expired.error';
import { plannerSessionValidationStrings } from '../config/strings/planner-session.validation';
import { PlannerSessionStatus, PlannerTokenSession } from '../model/planner-session.types';

const REFRESH_SKEW_MS = 60_000;
// Back off after a failed login so a repeated "Try to refresh" press does not hammer u-planner.
// Derived, not a literal: a cooldown shorter than one login would lapse while that login is still
// running, letting the next press start a second one behind it.
const REFRESH_COOLDOWN_MS = PLANNER_LOGIN_WORST_CASE_MS;
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
	private flight: { promise: Promise<PlannerTokenSession>; forced: boolean } | null = null;
	private lastFailure: RefreshFailure | null = null;
	private sessionGeneration = 0;
	// The store file is a cache that survives restarts, not the only copy. Holding the adopted
	// session here as well is what stops an unwritable disk costing a fresh institutional login on
	// every single request — see adoptSession.
	private adoptedSession: PlannerTokenSession | null = null;

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

	async getStatus(): Promise<{ status: PlannerSessionStatus; tokenExp: string | null }> {
		// Credentials first: an orphaned store file must not make an unconfigured system look active.
		if (!(await this.credentials.isConfigured(SCRAPER_PROVIDER_CODES.PLANNER))) {
			return { status: 'not_configured', tokenExp: null };
		}
		return this.statusForStoredSession();
	}

	/** The configured-status half of {@link getStatus}, split out so a caller that has already
	 * proven the credentials exist does not query for them a second time. */
	private statusForStoredSession(): {
		status: PlannerSessionStatus;
		tokenExp: string | null;
	} {
		const session = this.readSession();
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
	 * The adopted session wins over the file. Within one process it is always at least as new — it
	 * is set by the same call that attempts the write — so preferring it is what makes a failed
	 * write a lost cache rather than a lost session.
	 */
	private readSession(): PlannerTokenSession | null {
		return this.adoptedSession ?? this.store.read();
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
			if (isPlannerLoginError(error) || error instanceof PlannerSessionExpiredError) {
				const failure: RefreshFailure = {
					atMs: Date.now(),
					unreachable: error instanceof PlannerLoginUnreachableError,
				};
				this.lastFailure = failure;
				return this.reportFailure(failure);
			}
			throw error;
		}
		// The credential check above already answered `isConfigured`; re-asking would be a second
		// query for a fact this call has proven.
		return this.statusForStoredSession();
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
		return { status: 'expired', tokenExp: this.readSession()?.accessTokenExpiresAt ?? null };
	}

	/**
	 * Single-flight: concurrent callers share one login.
	 *
	 * A forced caller may only join a flight that is itself forced. Sharing a non-forced flight
	 * would hand it the cached session it is trying to replace — and the scraper's one-shot 401
	 * retry is a forced call, so that would re-send the rejected token and abort the whole run.
	 *
	 * The cached session is checked *before* any join, which is the other half of that rule. A
	 * scrape worker asking for whatever is valid must not be conscripted into an operator's forced
	 * "Try to refresh": it would wait out the full login timeout and then inherit a failure about a
	 * session it was not using, which the scraper reports as an expired run.
	 */
	private ensureSession(forceRefresh: boolean): Promise<PlannerTokenSession> {
		if (!forceRefresh) {
			const cached = this.readSession();
			if (cached && this.remaining(cached.accessTokenExpiresAt) > REFRESH_SKEW_MS) {
				return Promise.resolve(cached);
			}
		}

		const current = this.flight;
		if (current && (!forceRefresh || current.forced)) return current.promise;

		// What this caller wants replaced. If the flight it queues behind replaces it first, there
		// is nothing left to force — see afterCurrentFlight.
		const supersededToken = forceRefresh ? (this.readSession()?.accessToken ?? null) : null;
		const promise = this.afterCurrentFlight(
			current?.promise ?? null,
			forceRefresh,
			supersededToken,
		);
		const flight = { promise, forced: forceRefresh };
		this.flight = flight;

		// Attached immediately so the reset runs before any caller's continuation.
		void promise
			.finally(() => {
				if (this.flight === flight) this.flight = null;
			})
			.catch(() => undefined);

		return promise;
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
		const current = this.readSession();
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
		const existing = this.readSession();
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
		// Held before the write is attempted, so the generation below is truthful either way: the
		// session is adopted the moment it is in memory, whether or not it reaches disk.
		this.adoptedSession = session;
		this.persist(session);
		this.sessionGeneration += 1;
		this.lastFailure = null;
	}

	/**
	 * A failed write must not discard the session. The store is the only cross-restart cache, so
	 * throwing here would lose a session u-planner had already granted — and because the scraper
	 * continues past a per-course failure, the next request would log in again, and the next, at one
	 * institutional authentication per request until the disk recovered.
	 */
	private persist(session: PlannerTokenSession): void {
		try {
			this.store.save(session);
		} catch (error) {
			this.logger.error(
				`Planner session could not be persisted; it is held in memory only and will not ` +
					`survive a restart - ${error instanceof Error ? error.message : 'unknown error'}`,
			);
		}
	}

	private async login(): Promise<PlannerTokenSession> {
		try {
			const credential = await this.credentials.getDecrypted(SCRAPER_PROVIDER_CODES.PLANNER);
			if (!credential) {
				throw new PlannerSessionExpiredError('Planner credentials are not configured');
			}

			// Captured after the credentials are read, so a change that lands before this point is
			// simply used rather than mistaken for a supersession.
			const generation = this.sessionGeneration;
			const session = await this.loginClient.login(credential.username, credential.password);

			if (generation !== this.sessionGeneration) {
				// The credentials were replaced while this login was in flight, so this session
				// belongs to the retired account. Hand back what was adopted in the meantime rather
				// than letting a caller run its whole request under an identity that was just
				// rotated away.
				this.logger.warn('Planner login superseded by a credential change; session discarded');
				const adopted = this.readSession();
				if (adopted) return adopted;
				throw new PlannerSessionExpiredError('Planner credentials changed during login');
			}

			this.adoptSession(session);
			return session;
		} catch (error) {
			// Logged here rather than in refresh() so that scrape-time failures — which reach this
			// through getValidSession() and never touch refresh() — are not silent.
			if (isPlannerLoginError(error) || error instanceof PlannerSessionExpiredError) {
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
