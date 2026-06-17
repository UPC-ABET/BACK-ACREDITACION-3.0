import { BadRequestException, NotFoundException } from '@nestjs/common';
import { lcfcValidationStrings } from '../config/strings/lcfc.validation';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

export type LcfcTokenData = {
	surveyId: number;
	studentId: number;
	studentName: string;
	studentCode: string;
	programId: number;
	programName: string;
	academicPeriodId: number;
	period?: string;
	courseName?: string;
	campusId: number;
	courseSectionId: number;
	maxRegisterDate: string | null;
	surveyStatusCode: string;
};

export class LcfcValidation {
	static validateToken(tokenData: LcfcTokenData | null): asserts tokenData is LcfcTokenData {
		if (!tokenData) {
			throw new NotFoundException(lcfcValidationStrings.error.tokenNotFound);
		}
		if (tokenData.maxRegisterDate && new Date(tokenData.maxRegisterDate) < new Date()) {
			throw new BadRequestException(lcfcValidationStrings.error.tokenExpired);
		}
		if (tokenData.surveyStatusCode === TYPE_CODES.SURVEY_STATUS.CLOSED) {
			throw new BadRequestException(lcfcValidationStrings.error.alreadyCompleted);
		}
	}

	static validateCompleteScores(scores: { outcomeId: number; score: number }[]): void {
		if (!scores || scores.length === 0) {
			throw new BadRequestException(lcfcValidationStrings.error.noScores);
		}
		for (const item of scores) {
			if (item.score < 1 || item.score > 10) {
				throw new BadRequestException(lcfcValidationStrings.error.invalidScore);
			}
		}
	}

	static validateSendRequest(pendingCount: number): void {
		if (pendingCount === 0) {
			throw new BadRequestException(lcfcValidationStrings.error.noPending);
		}
	}
}
