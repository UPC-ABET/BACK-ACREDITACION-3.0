/** The stored session cannot be used. Consumers treat this as "re-authenticate". */
export class PlannerSessionExpiredError extends Error {
	constructor(message = 'Planner session expired') {
		super(message);
		this.name = 'PlannerSessionExpiredError';
	}
}

/**
 * u-planner answered and refused the credentials — a 4xx, a `status: false` body, or a response
 * missing the tokens. Re-sending the same pair will not help.
 *
 * A refusal genuinely disproves the stored session, which is why this — and only this — extends
 * {@link PlannerSessionExpiredError}.
 */
export class PlannerLoginRejectedError extends PlannerSessionExpiredError {
	constructor(message: string) {
		super(message);
		this.name = 'PlannerLoginRejectedError';
	}
}

/**
 * u-planner could not be reached, or answered with something it should never send. The credentials
 * may be perfectly correct and the stored session may still be good for hours.
 *
 * Deliberately **not** a {@link PlannerSessionExpiredError}: `PlannerScraperService` classifies a
 * run by that type alone, so inheriting it would report a transport outage as an expired session
 * and send the operator to re-enter a password that was never wrong.
 */
export class PlannerLoginUnreachableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PlannerLoginUnreachableError';
	}
}

/**
 * No usable Planner session can be obtained — the union of "the session is dead" and "we could not
 * reach u-planner to get one".
 *
 * This is the predicate almost every caller actually wants, and it must be used in preference to a
 * bare `instanceof PlannerSessionExpiredError`. Those two stopped being the same set when
 * {@link PlannerLoginUnreachableError} left the hierarchy, and every site that kept the bare check
 * silently changed meaning: `PlannerScraperService` stopped aborting a run on an outage and
 * retried the login once per remaining item instead.
 */
export const isPlannerSessionFailure = (
	error: unknown,
): error is PlannerSessionExpiredError | PlannerLoginUnreachableError =>
	error instanceof PlannerSessionExpiredError || error instanceof PlannerLoginUnreachableError;
