import { BadRequestException } from '@nestjs/common';
import { lcfcValidationStrings } from '../config/strings/lcfc.validation';

export class LcfcValidation {
	static validateToken(tokenData: any, token: string): void {
		if (!tokenData) {
			throw new BadRequestException(
				`Token inválido: no se encontró la encuesta asociada al token "${token}"`,
			);
		}
		if (tokenData.max_register_date && new Date(tokenData.max_register_date) < new Date()) {
			throw new BadRequestException(
				'El token ha expirado. El plazo para responder la encuesta LCFC ha vencido.',
			);
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
				throw new BadRequestException(
					`Puntaje inválido (${item.score}) para outcome_id ${item.outcome_id}. Debe estar entre 1 y 10.`,
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
