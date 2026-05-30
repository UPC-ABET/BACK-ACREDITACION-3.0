import { BadRequestException, NotFoundException } from '@nestjs/common';
import { graValidationStrings } from '../config/strings/gra.validation';

type GraTokenData = {
	survey_id: number;
	student_id: number;
	student_name: string;
	student_code: string;
	program_id: number;
	program_name: string;
	academic_period_id: number;
	max_register_date: string | null;
	survey_status: string;
};

export class GraValidation {
	static validateToken(
		tokenData: GraTokenData | null,
		_token: string,
	): asserts tokenData is GraTokenData {
		if (!tokenData) {
			throw new NotFoundException(graValidationStrings.error.tokenNotFound);
		}
		if (tokenData.maxRegisterDate && new Date(tokenData.maxRegisterDate) < new Date()) {
			throw new BadRequestException(
				'El token ha expirado. El plazo para responder la encuesta GRA ha vencido.',
			);
		}
		if (tokenData.survey_status === 'Cerrada') {
			throw new BadRequestException(graValidationStrings.error.alreadyCompleted);
		}
	}

	static validateCompleteScores(scores: { outcomeConfigId: number; score: number }[]): void {
		if (!scores || scores.length === 0) {
			throw new BadRequestException(graValidationStrings.error.noScores);
		}
		for (const item of scores) {
			if (item.score < 1 || item.score > 5) {
				throw new BadRequestException(
					`Puntaje inválido (${item.score}) para outcomeConfigId ${item.outcomeConfigId}. Debe estar entre 1 y 5.`,
				);
			}
		}
	}

	static validateSendEmailRequest(pendingCount: number): void {
		if (pendingCount === 0) {
			throw new BadRequestException(graValidationStrings.error.noPending);
		}
	}
}
