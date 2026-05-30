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
		if (tokenData.maxRegisterDate && new Date(tokenData.maxRegisterDate) < new Date()) {
			throw new BadRequestException(
				'El token ha expirado. El plazo para responder la encuesta LCFC ha vencido.',
			);
		}
		if (tokenData.surveyStatus === 'Cerrada') {
			throw new BadRequestException('Esta encuesta LCFC ya ha sido completada anteriormente.');
		}
	}

	static validateCompleteScores(scores: { outcomeId: number; score: number }[]): void {
		if (!scores || scores.length === 0) {
			throw new BadRequestException(lcfcValidationStrings.error.noScores);
		}
		for (const item of scores) {
			if (item.score < 1 || item.score > 10) {
				throw new BadRequestException(
					`Puntaje inválido (${item.score}) para outcomeId ${item.outcomeId}. Debe estar entre 1 y 10.`,
				);
			}
		}
	}

	static validateSendRequest(pendingCount: number): void {
		if (pendingCount === 0) {
			throw new BadRequestException(lcfcValidationStrings.error.noPending);
		}
	}
}
