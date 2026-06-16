export class PlannerSessionExpiredError extends Error {
	constructor(message = 'Planner session expired') {
		super(message);
		this.name = 'PlannerSessionExpiredError';
	}
}
