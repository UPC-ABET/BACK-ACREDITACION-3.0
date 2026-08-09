export class PlannerSessionExpiredError extends Error {
	constructor(message = 'Planner session expired') {
		super(message);
		this.name = 'PlannerSessionExpiredError';
	}
}

/**
 * u-planner answered and refused the credentials — a 4xx, a `status: false` body, or a response
 * missing the tokens. Re-sending the same pair will not help.
 */
export class PlannerLoginRejectedError extends PlannerSessionExpiredError {
	constructor(message: string) {
		super(message);
		this.name = 'PlannerLoginRejectedError';
	}
}

/**
 * u-planner could not be reached or failed on its own side. The credentials may be perfectly
 * correct, so this must never be reported to an operator as a rejected password.
 */
export class PlannerLoginUnreachableError extends PlannerSessionExpiredError {
	constructor(message: string) {
		super(message);
		this.name = 'PlannerLoginUnreachableError';
	}
}
