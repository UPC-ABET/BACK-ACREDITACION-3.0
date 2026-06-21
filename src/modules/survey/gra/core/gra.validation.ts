import { BadRequestError, NotFoundError } from 'src/commons/domain-error';
import { graValidationStrings } from '../config/strings/gra.validation';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

export type GraTokenData = {
	surveyId: number;
	studentId: number;
	studentName: string;
	studentCode: string;
	programId: number;
	programName: string;
	academicPeriodId: number;
	maxRegisterDate: string | null;
	surveyStatusCode: string;
};

export class GraValidation {
	static validateToken(tokenData: GraTokenData | null): asserts tokenData is GraTokenData {
		if (!tokenData) {
			throw new NotFoundError(graValidationStrings.error.tokenNotFound);
		}
		if (tokenData.maxRegisterDate && new Date(tokenData.maxRegisterDate) < new Date()) {
			throw new BadRequestError(graValidationStrings.error.tokenExpired);
		}
		if (tokenData.surveyStatusCode === TYPE_CODES.SURVEY_STATUS.CLOSED) {
			throw new BadRequestError(graValidationStrings.error.alreadyCompleted);
		}
	}

	static validateCompleteScores(scores: { outcomeConfigId: number; score: number }[]): void {
		if (!scores || scores.length === 0) {
			throw new BadRequestError(graValidationStrings.error.noScores);
		}
		for (const item of scores) {
			if (item.score < 1 || item.score > 5) {
				throw new BadRequestError(graValidationStrings.error.invalidScore);
			}
		}
	}

	static validateSendEmailRequest(pendingCount: number): void {
		if (pendingCount === 0) {
			throw new BadRequestError(graValidationStrings.error.noPending);
		}
	}
}
