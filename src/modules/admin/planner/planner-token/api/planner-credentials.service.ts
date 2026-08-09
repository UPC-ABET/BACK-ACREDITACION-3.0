import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { BadRequestError } from 'src/commons/domain-error';
import { ScraperCredentialService } from 'src/modules/admin/scraping/credentials/api/scraper-credentials.service';
import { SCRAPER_PROVIDER_CODES } from 'src/modules/admin/scraping/credentials/constants/scraper-provider-codes';
import { PLANNER_LOGIN_WORST_CASE_MS, PlannerLoginClient } from '../core/planner-login.client';
import {
	PlannerLoginRejectedError,
	PlannerLoginUnreachableError,
} from '../model/session-expired.error';
import { plannerSessionValidationStrings } from '../config/strings/planner-session.validation';
import {
	PlannerCredentialsResponseDto,
	PlannerSessionStatusDto,
	SavePlannerCredentialsDto,
} from '../model/planner-credentials.dtos';
import { PlannerTokenService } from './planner-token.service';

// This endpoint reports accepted / rejected / unreachable distinctly for caller-supplied values,
// which is the shape of a credential-testing oracle. Throttling leaves it usable for an operator
// fixing a typo and useless for spraying accounts from this server's address.
const VERIFY_PENALTY_MS = 30_000;

// The slot is claimed for the whole attempt, so the claim must outlast the login it guards —
// otherwise it lapses at the tail of a slow call and a second request slips through behind it.
const VERIFY_CLAIM_MS = PLANNER_LOGIN_WORST_CASE_MS + VERIFY_PENALTY_MS;

@Injectable()
export class PlannerCredentialsService {
	private blockedUntilMs: number | null = null;

	constructor(
		private readonly credentials: ScraperCredentialService,
		private readonly loginClient: PlannerLoginClient,
		private readonly tokenService: PlannerTokenService,
	) {}

	async getSummary(): Promise<PlannerCredentialsResponseDto> {
		return await this.credentials.getSummary(SCRAPER_PROVIDER_CODES.PLANNER);
	}

	/**
	 * Verify first, persist second. A pair u-planner refuses must leave nothing behind — not a
	 * credential row, and not a session file — so any previously working configuration survives a
	 * failed attempt untouched. Saving the new session last means no session obtained under the old
	 * credentials is left *on disk*; one already in flight still returns to its own caller.
	 */
	async save(dto: SavePlannerCredentialsDto): Promise<PlannerSessionStatusDto> {
		const username = dto.username.trim();
		const session = await this.verify(username, dto.password);

		await this.credentials.save({
			providerCode: SCRAPER_PROVIDER_CODES.PLANNER,
			username,
			password: dto.password,
		});
		this.tokenService.adoptSession(session);

		return await this.tokenService.getStatus();
	}

	private async verify(username: string, password: string) {
		if (this.blockedUntilMs !== null && Date.now() < this.blockedUntilMs) {
			throw new BadRequestError(plannerSessionValidationStrings.error.verificationCooldown);
		}

		// Claimed before the await, not after the outcome is known.
		const claim = Date.now() + VERIFY_CLAIM_MS;
		this.blockedUntilMs = claim;

		try {
			const session = await this.loginClient.login(username, password);
			this.release(claim);
			return session;
		} catch (error) {
			if (error instanceof PlannerLoginUnreachableError) {
				// Transport-level, so an HTTP exception rather than a domain error: the credentials
				// may be perfectly valid and the operator must not be told otherwise. The slot is
				// released — u-planner being down is not a failed guess.
				this.release(claim);
				throw new ServiceUnavailableException(plannerSessionValidationStrings.error.unreachable);
			}
			if (error instanceof PlannerLoginRejectedError) {
				this.penalise(claim);
				throw new BadRequestError(plannerSessionValidationStrings.error.invalidCredentials);
			}
			this.release(claim);
			throw error;
		}
	}

	/** Only the request that made the claim may drop it — otherwise it can erase someone else's. */
	private release(claim: number): void {
		if (this.blockedUntilMs === claim) this.blockedUntilMs = null;
	}

	/**
	 * Measured from the response, not from entry: a slow rejection must still cost a full window.
	 * Replaces this request's own claim (the attempt is over, so the longer claim has no work left
	 * to guard) but never shortens someone else's, so a concurrent request cannot erase a penalty.
	 */
	private penalise(claim: number): void {
		const until = Date.now() + VERIFY_PENALTY_MS;
		this.blockedUntilMs =
			this.blockedUntilMs === claim ? until : Math.max(this.blockedUntilMs ?? 0, until);
	}
}
