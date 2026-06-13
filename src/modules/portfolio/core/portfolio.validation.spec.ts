import { HttpException } from '@nestjs/common';
import { PortfolioValidation } from './portfolio.validation';

describe('PortfolioValidation', () => {
	describe('validateCreate', () => {
		it('passes when companyId is provided', () => {
			expect(() =>
				PortfolioValidation.validateCreate({
					name: 'Test',
					description: 'Desc',
					academicPeriodId: 1,
					modalityTypeId: 1,
					isFromUPC: false,
					programId: 1,
					companyId: 10,
				}),
			).not.toThrow();
		});

		it('passes when companyCode is provided', () => {
			expect(() =>
				PortfolioValidation.validateCreate({
					name: 'Test',
					description: 'Desc',
					academicPeriodId: 1,
					modalityTypeId: 1,
					isFromUPC: false,
					programId: 1,
					companyCode: 'UPC',
				}),
			).not.toThrow();
		});

		it('throws HttpException when neither companyId nor companyCode is provided', () => {
			expect(() =>
				PortfolioValidation.validateCreate({
					name: 'Test',
					description: 'Desc',
					academicPeriodId: 1,
					modalityTypeId: 1,
					isFromUPC: false,
					programId: 1,
				}),
			).toThrow(HttpException);
		});
	});

	describe('validateUpdate', () => {
		it('passes when neither companyId nor companyCode is touched', () => {
			expect(() => PortfolioValidation.validateUpdate({ name: 'New name' })).not.toThrow();
		});

		it('passes when companyCode is provided without companyId', () => {
			expect(() => PortfolioValidation.validateUpdate({ companyCode: 'UPC' })).not.toThrow();
		});

		it('passes when companyId is provided', () => {
			expect(() => PortfolioValidation.validateUpdate({ companyId: 5 })).not.toThrow();
		});

		it('throws HttpException when companyId is explicitly null with no companyCode', () => {
			expect(() =>
				PortfolioValidation.validateUpdate({ companyId: null as unknown as undefined }),
			).toThrow(HttpException);
		});
	});

	describe('generateProjectCode', () => {
		it('returns base + 01 when lastCode is null', () => {
			expect(PortfolioValidation.generateProjectCode(null, '2025-1')).toBe('P2025-101');
		});

		it('increments two-digit suffix correctly', () => {
			expect(PortfolioValidation.generateProjectCode('P2025-101', '2025-1')).toBe('P2025-102');
		});

		it('does not zero-pad when number exceeds 9', () => {
			expect(PortfolioValidation.generateProjectCode('P2025-109', '2025-1')).toBe('P2025-110');
		});

		it('returns base + 01 when suffix is not a valid number', () => {
			expect(PortfolioValidation.generateProjectCode('P2025-1XX', '2025-1')).toBe('P2025-101');
		});

		it('pads single-digit increments to two characters', () => {
			expect(PortfolioValidation.generateProjectCode('P2025-103', '2025-1')).toBe('P2025-104');
		});
	});
});
