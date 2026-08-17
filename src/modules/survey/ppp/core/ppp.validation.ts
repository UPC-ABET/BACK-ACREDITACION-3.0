import { BadRequestError, NotFoundError } from 'src/commons/domain-error';
import { PppConfigRepository } from './ppp-config.repository';
import { CreatePppConfigDto, CreatePppSurveyDto } from '../model/ppp.dtos';
import { pppValidationStrings } from '../config/strings/ppp.validation';
import type { PppUploadRowError } from '../config/strings/ppp-upload-messages';

/** The bulk-import row after header aliases are resolved and cells are normalized.
 *  `startDate`/`endDate` stay `unknown`: they are raw cell values handed straight to
 *  the `information` blob, and typing them here would drag ExcelJS into the domain
 *  layer for no gain. */
export type PppExcelRow = {
	studentCode: string;
	practiceNumber: number;
	totalHours: number | null;
	companyName: string | null;
	bossName: string | null;
	startDate: unknown;
	endDate: unknown;
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

	/** Everything about a bulk-import row that can be judged without touching the
	 *  database. The DB-dependent checks (student exists, placement resolves, the
	 *  practice is not already registered) run batched in the service. */
	static validateExcelRow(row: PppExcelRow): { valid: boolean; errors: PppUploadRowError[] } {
		const errors: PppUploadRowError[] = [];

		if (!row.studentCode)
			errors.push({ key: pppValidationStrings.error.upload.studentCodeRequired });
		if (!row.practiceNumber || ![1, 2].includes(Number(row.practiceNumber))) {
			errors.push({ key: pppValidationStrings.error.upload.invalidPracticeNumber });
		}

		return { valid: errors.length === 0, errors };
	}

	/**
	 * Judges one competence cell. Blank means "not answered" and is reported at the
	 * row level (`noScores`) rather than per column; anything else must parse to a
	 * number in 1..5. The bulk path deliberately mirrors `validateCreateSurvey` here —
	 * a score the manual form rejects cannot be allowed in through the importer.
	 */
	static validateExcelScore(
		rawScore: string,
		label: string,
	): { score: number | null; error: PppUploadRowError | null } {
		if (rawScore === '') return { score: null, error: null };

		const score = Number(rawScore);
		if (!Number.isFinite(score) || score < 1 || score > 5) {
			return {
				score: null,
				error: {
					key: pppValidationStrings.error.upload.invalidScore,
					args: { label, value: rawScore },
				},
			};
		}

		return { score, error: null };
	}

	// Color classification thresholds (PPP)
	static classifyScore(avgScore: number): 'ROJO' | 'AMARILLO' | 'VERDE' {
		if (avgScore < 2.5) return 'ROJO';
		if (avgScore < 3.2) return 'AMARILLO';
		return 'VERDE';
	}
}
