import { BadRequestException } from '@nestjs/common';
import { CreatePortfolioProjectDto, UpdatePortfolioProjectDto } from '../model/portfolio.dtos';

export class PortfolioValidation {
	static validateCreate(dto: CreatePortfolioProjectDto): void {
		if (!dto.companyId && !dto.companyCode) {
			throw new BadRequestException('Se debe proporcionar companyId o companyCode.');
		}
	}

	static validateUpdate(dto: UpdatePortfolioProjectDto): void {
		if (dto.companyId === undefined && dto.companyCode === undefined) return;
		if (dto.companyId === null && !dto.companyCode) {
			throw new BadRequestException('Se debe proporcionar companyId o companyCode para actualizar la empresa.');
		}
	}

	static validateProjectCode(code: string): boolean {
		return /^P\d{4}-\d+\d{2}$/.test(code) || /^P\d{4}-\d+$/.test(code);
	}

	static generateProjectCode(lastCode: string | null, cycleCode: string): string {
		const base = `P${cycleCode}`;
		if (!lastCode) return `${base}01`;

		const numeric = lastCode.substring(base.length);
		const n = parseInt(numeric, 10);
		if (isNaN(n)) return `${base}01`;

		const next = n + 1;
		return `${base}${next < 10 ? String(next).padStart(2, '0') : next}`;
	}
}
