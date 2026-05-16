import { HttpException, HttpStatus } from '@nestjs/common';
import { PppConfigRepository } from './ppp-config.repository';
import { CreatePppConfigDto, CreatePppSurveyDto } from '../model/ppp.dtos';

export class PppValidation {
	static async validateCreateConfig(repo: PppConfigRepository, dto: CreatePppConfigDto): Promise<void> {
		const errors: string[] = [];

		const exists = await repo.existsPpp(dto.outcome_id, dto.program_id, dto.academic_period_id);
		if (exists) {
			errors.push('Ya existe una configuración PPP para este outcome en el programa y período seleccionados');
		}

		if (errors.length > 0) {
			throw new HttpException({ message: 'Error al crear configuración PPP', errors }, HttpStatus.BAD_REQUEST);
		}
	}

	static async validateUpdateConfig(repo: PppConfigRepository, id: number): Promise<void> {
		const exists = await repo.findOnePpp(id);
		if (!exists) {
			throw new HttpException({ message: 'Configuración PPP no encontrada', errors: [`No existe configuración PPP con ID ${id}`] }, HttpStatus.NOT_FOUND);
		}
	}

	static async validateDeleteConfig(repo: PppConfigRepository, id: number): Promise<void> {
		const exists = await repo.findOnePpp(id);
		if (!exists) {
			throw new HttpException({ message: 'Configuración PPP no encontrada', errors: [`No existe configuración PPP con ID ${id}`] }, HttpStatus.NOT_FOUND);
		}
	}

	static validateCreateSurvey(dto: CreatePppSurveyDto): void {
		const errors: string[] = [];

		if (dto.practice_number !== 1 && dto.practice_number !== 2) {
			errors.push('El número de práctica debe ser 1 (Práctica I) o 2 (Práctica II)');
		}

		if (dto.scores?.length === 0) {
			errors.push('Debe registrar al menos un puntaje de competencia');
		}

		dto.scores?.forEach((s, i) => {
			if (s.score < 1 || s.score > 5) {
				errors.push(`Puntaje inválido en competencia #${i + 1}: debe estar entre 1.0 y 5.0`);
			}
		});

		if (dto.ruc && !/^\d{11}$/.test(dto.ruc)) {
			errors.push('El RUC debe tener exactamente 11 dígitos numéricos');
		}

		if (errors.length > 0) {
			throw new HttpException({ message: 'Error al registrar encuesta PPP', errors }, HttpStatus.BAD_REQUEST);
		}
	}

	static validateExcelRow(row: any, rowNumber: number): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!row.student_code) errors.push(`Fila ${rowNumber}: Código de alumno requerido`);
		if (!row.practice_number || ![1, 2].includes(Number(row.practice_number))) {
			errors.push(`Fila ${rowNumber}: Número de práctica inválido (debe ser 1 o 2)`);
		}
		if (row.ruc && !/^\d{11}$/.test(String(row.ruc))) {
			errors.push(`Fila ${rowNumber}: RUC inválido (debe tener 11 dígitos)`);
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
