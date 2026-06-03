import { HttpException } from '@nestjs/common';

import { ChartHeadsValidation } from './chart-heads.validation';
import type { ConfigureChartHeadsDto } from '../model/chart-heads.dtos';

const mockRepo = {
	academicPeriodExists: jest.fn(),
	findMissingSchoolIds: jest.fn(),
	findMissingUserIds: jest.fn(),
};

function makeDto(overrides: Partial<ConfigureChartHeadsDto> = {}): ConfigureChartHeadsDto {
	return {
		academicPeriodId: 1,
		dean: { firstName: 'Juan', lastName: 'Perez', userId: 12, title: { es: 'Decanato' } },
		directors: [
			{ schoolId: 3, firstName: 'Sofia', lastName: 'Torres', userId: 45, title: { es: 'Dir' } },
		],
		...overrides,
	} as ConfigureChartHeadsDto;
}

describe('ChartHeadsValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRepo.academicPeriodExists.mockResolvedValue(true);
		mockRepo.findMissingSchoolIds.mockResolvedValue([]);
		mockRepo.findMissingUserIds.mockResolvedValue([]);
	});

	describe('validateConfigure', () => {
		it('passes when period, schools and users all resolve', async () => {
			await expect(
				ChartHeadsValidation.validateConfigure(mockRepo as any, makeDto()),
			).resolves.toBeUndefined();
		});

		it('throws when the academic period does not exist', async () => {
			mockRepo.academicPeriodExists.mockResolvedValue(false);
			await expect(
				ChartHeadsValidation.validateConfigure(mockRepo as any, makeDto()),
			).rejects.toThrow(HttpException);
		});

		it('throws when the payload repeats a school id', async () => {
			const dto = makeDto({
				directors: [
					{ schoolId: 3, firstName: 'A', lastName: 'A', title: { es: 'x' } },
					{ schoolId: 3, firstName: 'B', lastName: 'B', title: { es: 'y' } },
				],
			});
			await expect(
				ChartHeadsValidation.validateConfigure(mockRepo as any, dto),
			).rejects.toThrow(HttpException);
		});

		it('throws when a school does not exist', async () => {
			mockRepo.findMissingSchoolIds.mockResolvedValue([99]);
			await expect(
				ChartHeadsValidation.validateConfigure(mockRepo as any, makeDto()),
			).rejects.toThrow(HttpException);
		});

		it('throws when a referenced user does not exist', async () => {
			mockRepo.findMissingUserIds.mockResolvedValue([12]);
			await expect(
				ChartHeadsValidation.validateConfigure(mockRepo as any, makeDto()),
			).rejects.toThrow(HttpException);
		});

		it('skips the user check when no userId is provided', async () => {
			const dto = makeDto({
				dean: { firstName: 'Juan', lastName: 'Perez', title: { es: 'Decanato' } },
				directors: [{ schoolId: 3, firstName: 'Sofia', lastName: 'Torres', title: { es: 'Dir' } }],
			});
			await ChartHeadsValidation.validateConfigure(mockRepo as any, dto);
			expect(mockRepo.findMissingUserIds).toHaveBeenCalledWith([]);
		});
	});
});
