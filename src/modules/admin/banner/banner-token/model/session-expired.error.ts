export class SessionExpiredError extends Error {
	constructor(message = 'Banner session expired') {
		super(message);
		this.name = 'SessionExpiredError';
	}
}
