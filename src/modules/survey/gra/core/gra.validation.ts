import { BadRequestException } from '@nestjs/common';

export class GraValidation {
	static validateToken(tokenData: any, token: string): void {
		if (!tokenData) {
			throw new BadRequestException(
				`Token inválido: no se encontró la encuesta asociada al token "${token}"`,
			);
		}
		if (tokenData.max_register_date && new Date(tokenData.max_register_date) < new Date()) {
			throw new BadRequestException(
				'El token ha expirado. El plazo para responder la encuesta GRA ha vencido.',
			);
		}
		if (tokenData.survey_status === 'Cerrada') {
			throw new BadRequestException('Esta encuesta GRA ya ha sido completada anteriormente.');
		}
	}

	static validateCompleteScores(scores: { outcome_config_id: number; score: number }[]): void {
		if (!scores || scores.length === 0) {
			throw new BadRequestException(
				'Debe proporcionar al menos un puntaje para completar la encuesta GRA.',
			);
		}
		for (const item of scores) {
			if (item.score < 1 || item.score > 5) {
				throw new BadRequestException(
					`Puntaje inválido (${item.score}) para outcome_config_id ${item.outcome_config_id}. Debe estar entre 1 y 5.`,
				);
			}
		}
	}

	static validateSendEmailRequest(pendingCount: number): void {
		if (pendingCount === 0) {
			throw new BadRequestException(
				'No hay estudiantes pendientes de notificación para enviar en el período seleccionado.',
			);
		}
	}
}
