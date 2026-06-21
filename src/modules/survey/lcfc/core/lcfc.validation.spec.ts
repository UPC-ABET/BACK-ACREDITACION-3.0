import { DomainError } from 'src/commons/domain-error';
import { LcfcValidation, LcfcTokenData } from './lcfc.validation';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

const baseToken: LcfcTokenData = {
	surveyId: 1,
	studentId: 2,
	studentName: 'Ada',
	studentCode: 'EST-1',
	programId: 3,
	programName: 'CS',
	academicPeriodId: 4,
	campusId: 5,
	courseSectionId: 6,
	maxRegisterDate: null,
	surveyStatusCode: 'open',
};

describe('LcfcValidation', () => {
	describe('validateToken', () => {
		it('passes for an open survey with no deadline', () => {
			expect(() => LcfcValidation.validateToken({ ...baseToken })).not.toThrow();
		});

		it('passes for a future deadline', () => {
			expect(() =>
				LcfcValidation.validateToken({ ...baseToken, maxRegisterDate: '2999-12-31' }),
			).not.toThrow();
		});

		it('throws NotFound when the token is missing', () => {
			expect(() => LcfcValidation.validateToken(null)).toThrow(DomainError);
		});

		it('throws BadRequest when the deadline has passed', () => {
			expect(() =>
				LcfcValidation.validateToken({ ...baseToken, maxRegisterDate: '2000-01-01' }),
			).toThrow(DomainError);
		});

		it('throws BadRequest when the survey is already closed', () => {
			expect(() =>
				LcfcValidation.validateToken({
					...baseToken,
					surveyStatusCode: TYPE_CODES.SURVEY_STATUS.CLOSED,
				}),
			).toThrow(DomainError);
		});
	});

	describe('validateCompleteScores', () => {
		it('passes for scores within [1, 10]', () => {
			expect(() =>
				LcfcValidation.validateCompleteScores([
					{ outcomeId: 1, score: 1 },
					{ outcomeId: 2, score: 10 },
				]),
			).not.toThrow();
		});

		it('throws when there are no scores', () => {
			expect(() => LcfcValidation.validateCompleteScores([])).toThrow(DomainError);
		});

		it('throws when a score is out of range', () => {
			expect(() => LcfcValidation.validateCompleteScores([{ outcomeId: 1, score: 11 }])).toThrow(
				DomainError,
			);
		});
	});

	describe('validateSendRequest', () => {
		it('passes when there are pending recipients', () => {
			expect(() => LcfcValidation.validateSendRequest(3)).not.toThrow();
		});

		it('throws when there are no pending recipients', () => {
			expect(() => LcfcValidation.validateSendRequest(0)).toThrow(DomainError);
		});
	});
});
