import { BadRequestError, NotFoundError } from 'src/commons/domain-error';
import { PppConfigRepository } from './ppp-config.repository';
import { CreatePppConfigDto, CreatePppSurveyDto } from '../model/ppp.dtos';
import { pppValidationStrings } from '../config/strings/ppp.validation';

/**
 * Spanish text for the bulk-upload row errors — not i18n keys resolved by the
 * frontend, because these are written directly into the "Errores" column of the
 * downloaded Excel (whose own headers, e.g. "Codigo Alumno", are already Spanish)
 * and into the job's error list, both consumed by the same Spanish-speaking users.
 */
export const pppUploadRowMessages = {
	studentCodeRequired: 'El código de alumno es obligatorio',
	invalidPracticeNumber: 'Número de práctica inválido (debe ser 1 o 2)',
	studentNotFound: (code: string) => `No se encontró al alumno con código "${code}"`,
	noCourseSection: 'No hay una sección de curso disponible para registrar la práctica',
	saveError: (reason: string) => `Error al guardar: ${reason}`,
};

export class PppValidation {
	static async validateCreateConfig(
		repo: PppConfigRepository,
		dto: CreatePppConfigDto,
		academicPeriodId?: number | null,
	): Promise<void> {
		const exists = await repo.existsPpp(
			dto.outcomeId,
			dto.programId,
			academicPeriodId ?? undefined,
		);
		if (exists) {
			throw new BadRequestError({ message: pppValidationStrings.error.configExists });
		}
	}

	static async validateUpdateConfig(repo: PppConfigRepository, id: number): Promise<void> {
		const exists = await repo.findOnePpp(id);
		if (!exists) {
			throw new NotFoundError({ message: pppValidationStrings.error.configNotFound });
		}
	}

	static async validateDeleteConfig(repo: PppConfigRepository, id: number): Promise<void> {
		const exists = await repo.findOnePpp(id);
		if (!exists) {
			throw new NotFoundError({ message: pppValidationStrings.error.configNotFound });
		}
	}

	static validateCreateSurvey(dto: CreatePppSurveyDto): void {
		if (dto.practiceNumber !== 1 && dto.practiceNumber !== 2) {
			throw new BadRequestError({ message: pppValidationStrings.error.invalidPracticeNumber });
		}

		if (dto.scores?.length === 0) {
			throw new BadRequestError({ message: pppValidationStrings.error.noScores });
		}

		const hasInvalidScore = dto.scores?.some((s) => s.score < 1 || s.score > 5);
		if (hasInvalidScore) {
			throw new BadRequestError({ message: pppValidationStrings.error.invalidScore });
		}

		if (dto.ruc && !/^\d{11}$/.test(dto.ruc)) {
			throw new BadRequestError({ message: pppValidationStrings.error.invalidRuc });
		}
	}

	static validateExcelRow(row: any): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!row.studentCode) errors.push(pppUploadRowMessages.studentCodeRequired);
		if (!row.practiceNumber || ![1, 2].includes(Number(row.practiceNumber))) {
			errors.push(pppUploadRowMessages.invalidPracticeNumber);
		}

		return { valid: errors.length === 0, errors };
	}

	// Color classification thresholds (PPP)
	static classifyScore(avgScore: number): 'ROJO' | 'AMARILLO' | 'VERDE' {
		if (avgScore < 2.5) return 'ROJO';
		if (avgScore < 3.2) return 'AMARILLO';
		return 'VERDE';
	}
}
