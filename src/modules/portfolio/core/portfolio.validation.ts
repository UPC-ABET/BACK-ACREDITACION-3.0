import { HttpException, HttpStatus } from '@nestjs/common';
import { CreatePortfolioProjectDto, UpdatePortfolioProjectDto } from '../model/portfolio.dtos';
import { portfolioValidationStrings } from '../config/strings/portfolio.validation';

export class PortfolioValidation {
	static validateCreate(dto: CreatePortfolioProjectDto): void {
		const errors: string[] = [];

		if (!dto.companyId && !dto.companyCode) {
			errors.push(portfolioValidationStrings.error.companyRequired);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{ message: portfolioValidationStrings.result.createFailed, errors },
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static validateUpdate(dto: UpdatePortfolioProjectDto): void {
		const errors: string[] = [];

		if (dto.companyId === undefined && dto.companyCode === undefined) return;

		if (dto.companyId === null && !dto.companyCode) {
			errors.push(portfolioValidationStrings.error.companyRequired);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{ message: portfolioValidationStrings.result.updateFailed, errors },
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static generateProjectCode(lastCode: string | null, cycleCode: string): string {
		const base = `P${cycleCode}`;
		if (!lastCode) return `${base}01`;

		const numeric = lastCode.substring(base.length);
		const n = Number.parseInt(numeric, 10);
		if (Number.isNaN(n)) return `${base}01`;

		const next = n + 1;
		return `${base}${next < 10 ? String(next).padStart(2, '0') : next}`;
	}
}
