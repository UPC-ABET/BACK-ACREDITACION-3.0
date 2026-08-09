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

/** Either outcome of a login attempt, for the paths that must log both but discriminate neither. */
export const isPlannerLoginError = (
	error: unknown,
): error is PlannerLoginRejectedError | PlannerLoginUnreachableError =>
	error instanceof PlannerLoginRejectedError || error instanceof PlannerLoginUnreachableError;
