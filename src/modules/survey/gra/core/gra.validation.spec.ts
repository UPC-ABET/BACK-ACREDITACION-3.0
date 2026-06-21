import { DomainError } from 'src/commons/domain-error';
import { GraValidation, GraTokenData } from './gra.validation';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

const baseToken: GraTokenData = {
	surveyId: 1,
	studentId: 2,
	studentName: 'Ada',
	studentCode: 'EST-1',
	programId: 3,
	programName: 'CS',
	academicPeriodId: 4,
	maxRegisterDate: null,
	surveyStatusCode: 'open',
};

describe('GraValidation', () => {
	describe('validateToken', () => {
		it('passes for an open survey with no deadline', () => {
			expect(() => GraValidation.validateToken({ ...baseToken })).not.toThrow();
		});

		it('passes for a future deadline', () => {
			expect(() =>
				GraValidation.validateToken({ ...baseToken, maxRegisterDate: '2999-12-31' }),
			).not.toThrow();
		});

		it('throws NotFound when the token is missing', () => {
			expect(() => GraValidation.validateToken(null)).toThrow(DomainError);
		});

		it('throws BadRequest when the deadline has passed', () => {
			expect(() =>
				GraValidation.validateToken({ ...baseToken, maxRegisterDate: '2000-01-01' }),
			).toThrow(DomainError);
		});

		it('throws BadRequest when the survey is already closed', () => {
			expect(() =>
				GraValidation.validateToken({
					...baseToken,
					surveyStatusCode: TYPE_CODES.SURVEY_STATUS.CLOSED,
				}),
			).toThrow(DomainError);
		});
	});

	describe('validateCompleteScores', () => {
		it('passes for scores within [1, 5]', () => {
			expect(() =>
				GraValidation.validateCompleteScores([
					{ outcomeConfigId: 1, score: 1 },
					{ outcomeConfigId: 2, score: 5 },
				]),
			).not.toThrow();
		});

		it('throws when there are no scores', () => {
			expect(() => GraValidation.validateCompleteScores([])).toThrow(DomainError);
		});

		it('throws when a score is out of range', () => {
			expect(() =>
				GraValidation.validateCompleteScores([{ outcomeConfigId: 1, score: 6 }]),
			).toThrow(DomainError);
		});
	});

	describe('validateSendEmailRequest', () => {
		it('passes when there are pending recipients', () => {
			expect(() => GraValidation.validateSendEmailRequest(3)).not.toThrow();
		});

		it('throws when there are no pending recipients', () => {
			expect(() => GraValidation.validateSendEmailRequest(0)).toThrow(DomainError);
		});
	});
});
