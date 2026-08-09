import {
	isPlannerSessionFailure,
	PlannerLoginRejectedError,
	PlannerLoginUnreachableError,
	PlannerSessionExpiredError,
} from './planner-session.errors';

/**
 * The hierarchy is load-bearing, not incidental: `PlannerScraperService` classifies a whole scrape
 * run by `instanceof PlannerSessionExpiredError`, so which errors are inside it decides whether an
 * operator is told their session lapsed or that the run failed. Both directions have already been
 * wrong once — inheriting it reported a transport outage as an expired session, and the argument
 * "the scraper needed no change" stood in for a test.
 */
describe('planner session errors', () => {
	it('treats a refused login as proof the stored session is dead', () => {
		expect(new PlannerLoginRejectedError('401')).toBeInstanceOf(PlannerSessionExpiredError);
	});

	it('does not treat an unreachable u-planner as an expired session', () => {
		expect(new PlannerLoginUnreachableError('ECONNREFUSED')).not.toBeInstanceOf(
			PlannerSessionExpiredError,
		);
	});

	it('keeps the two login outcomes distinguishable from each other', () => {
		expect(new PlannerLoginUnreachableError('x')).not.toBeInstanceOf(PlannerLoginRejectedError);
		expect(new PlannerLoginRejectedError('x')).not.toBeInstanceOf(PlannerLoginUnreachableError);
	});

	describe('isPlannerSessionFailure', () => {
		it.each([
			['a refused login', new PlannerLoginRejectedError('401')],
			['an unreachable u-planner', new PlannerLoginUnreachableError('ECONNREFUSED')],
			['a bare expired session', new PlannerSessionExpiredError()],
		])('covers %s', (_label, error) => {
			expect(isPlannerSessionFailure(error)).toBe(true);
		});

		it.each([
			['an unrelated error', new Error('boom')],
			['a programmer error', new TypeError('boom')],
			['a non-error value', 'boom'],
			['null', null],
		])('does not cover %s', (_label, error) => {
			expect(isPlannerSessionFailure(error)).toBe(false);
		});
	});
});
