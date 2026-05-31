import { HttpException, HttpStatus } from '@nestjs/common';
import { PppConfigRepository } from './ppp-config.repository';
import { CreatePppConfigDto, CreatePppSurveyDto } from '../model/ppp.dtos';

export class PppValidation {
	static async validateCreateConfig(
		repo: PppConfigRepository,
		dto: CreatePppConfigDto,
	): Promise<void> {
		const errors: string[] = [];

		const exists = await repo.existsPpp(dto.outcomeId, dto.programId, dto.academicPeriodId);
		if (exists) {
			errors.push(
				'A PPP configuration already exists for this outcome in the selected program and period',
			);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{ message: 'Error creating PPP configuration', errors },
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdateConfig(repo: PppConfigRepository, id: number): Promise<void> {
		const exists = await repo.findOnePpp(id);
		if (!exists) {
			throw new HttpException(
				{
					message: 'PPP configuration not found',
					errors: [`No PPP configuration exists with ID ${id}`],
				},
				HttpStatus.NOT_FOUND,
			);
		}
	}

	static async validateDeleteConfig(repo: PppConfigRepository, id: number): Promise<void> {
		const exists = await repo.findOnePpp(id);
		if (!exists) {
			throw new HttpException(
				{
					message: 'PPP configuration not found',
					errors: [`No PPP configuration exists with ID ${id}`],
				},
				HttpStatus.NOT_FOUND,
			);
		}
	}

	static validateCreateSurvey(dto: CreatePppSurveyDto): void {
		const errors: string[] = [];

		if (dto.practiceNumber !== 1 && dto.practiceNumber !== 2) {
			errors.push('Practice number must be 1 (Practice I) or 2 (Practice II)');
		}

		if (dto.scores?.length === 0) {
			errors.push('At least one outcome score must be provided');
		}

		dto.scores?.forEach((s, i) => {
			if (s.score < 1 || s.score > 5) {
				errors.push(`Invalid score for outcome #${i + 1}: must be between 1.0 and 5.0`);
			}
		});

		if (dto.ruc && !/^\d{11}$/.test(dto.ruc)) {
			errors.push('RUC must be exactly 11 numeric digits');
		}

		if (errors.length > 0) {
			throw new HttpException(
				{ message: 'Error registering PPP survey', errors },
				HttpStatus.BAD_REQUEST,
			);
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
