import { BadRequestException, NotFoundException } from '@nestjs/common';
import { lcfcValidationStrings } from '../config/strings/lcfc.validation';

type LcfcTokenData = {
	survey_id: number;
	student_id: number;
	student_name: string;
	student_code: string;
	program_id: number;
	program_name: string;
	academic_period_id: number;
	course_section_id: number;
	max_register_date: string | null;
	survey_status: string;
};

export class LcfcValidation {
	static validateToken(
		tokenData: LcfcTokenData | null,
		_token: string,
	): asserts tokenData is LcfcTokenData {
		if (!tokenData) {
			throw new NotFoundException(lcfcValidationStrings.error.tokenNotFound);
		}
		if (tokenData.max_register_date && new Date(tokenData.max_register_date) < new Date()) {
			throw new BadRequestException(lcfcValidationStrings.error.tokenExpired);
		}
		if (tokenData.survey_status === 'Cerrada') {
			throw new BadRequestException(lcfcValidationStrings.error.alreadyCompleted);
		}
	}

	static validateCompleteScores(scores: { outcome_id: number; score: number }[]): void {
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
