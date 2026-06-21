import { BadRequestError, NotFoundError } from 'src/commons/domain-error';
import { PppConfigRepository } from './ppp-config.repository';
import { CreatePppConfigDto, CreatePppSurveyDto } from '../model/ppp.dtos';
import { pppValidationStrings } from '../config/strings/ppp.validation';

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

	static validateExcelRow(row: any, rowNumber: number): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!row.studentCode) errors.push(`Row ${rowNumber}: Student code is required`);
		if (!row.practiceNumber || ![1, 2].includes(Number(row.practiceNumber))) {
			errors.push(`Row ${rowNumber}: Invalid practice number (must be 1 or 2)`);
		}
		if (row.ruc && !/^\d{11}$/.test(String(row.ruc))) {
			errors.push(`Row ${rowNumber}: Invalid RUC (must have 11 digits)`);
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
