import { DomainError } from 'src/commons/domain-error';

import { ChartHeadsValidation } from './chart-heads.validation';
import type { ConfigureChartHeadsDto } from '../model/chart-heads.dtos';

const mockRepo = {
	academicPeriodExists: jest.fn(),
	findMissingSchoolIds: jest.fn(),
	findMissingStaffIds: jest.fn(),
	findMissingUserIds: jest.fn(),
	findMissingProgramIds: jest.fn(),
	findProgramsConfiguredForOtherSchool: jest.fn(),
};

function makeDto(overrides: Partial<ConfigureChartHeadsDto> = {}): ConfigureChartHeadsDto {
	return {
		academicPeriodId: 1,
		dean: { staffId: 9, userId: 12, title: { es: 'Decanato' } },
		directors: [{ schoolId: 3, staffId: 10, userId: 45, title: { es: 'Dir' } }],
		...overrides,
	} as ConfigureChartHeadsDto;
}

describe('ChartHeadsValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRepo.academicPeriodExists.mockResolvedValue(true);
		mockRepo.findMissingSchoolIds.mockResolvedValue([]);
		mockRepo.findMissingStaffIds.mockResolvedValue([]);
		mockRepo.findMissingUserIds.mockResolvedValue([]);
		mockRepo.findMissingProgramIds.mockResolvedValue([]);
		mockRepo.findProgramsConfiguredForOtherSchool.mockResolvedValue([]);
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
			).rejects.toThrow(DomainError);
		});

		it('throws when the payload repeats a school id', async () => {
			const dto = makeDto({
				directors: [
					{ schoolId: 3, staffId: 10, title: { es: 'x' } },
					{ schoolId: 3, staffId: 11, title: { es: 'y' } },
				],
			});
			await expect(ChartHeadsValidation.validateConfigure(mockRepo as any, dto)).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when a school does not exist', async () => {
			mockRepo.findMissingSchoolIds.mockResolvedValue([99]);
			await expect(
				ChartHeadsValidation.validateConfigure(mockRepo as any, makeDto()),
			).rejects.toThrow(DomainError);
		});

		it('throws when a referenced staff does not exist', async () => {
			mockRepo.findMissingStaffIds.mockResolvedValue([9]);
			await expect(
				ChartHeadsValidation.validateConfigure(mockRepo as any, makeDto()),
			).rejects.toThrow(DomainError);
		});

		it('throws when a referenced user does not exist', async () => {
			mockRepo.findMissingUserIds.mockResolvedValue([12]);
			await expect(
				ChartHeadsValidation.validateConfigure(mockRepo as any, makeDto()),
			).rejects.toThrow(DomainError);
		});

		it('skips the user check when no userId is provided', async () => {
			const dto = makeDto({
				dean: { staffId: 9, title: { es: 'Decanato' } },
				directors: [{ schoolId: 3, staffId: 10, title: { es: 'Dir' } }],
			});
			await ChartHeadsValidation.validateConfigure(mockRepo as any, dto);
			expect(mockRepo.findMissingUserIds).toHaveBeenCalledWith([]);
		});

		it('passes when a director carries programs that all resolve', async () => {
			const dto = makeDto({
				directors: [
					{
						schoolId: 3,
						staffId: 10,
						title: { es: 'Dir' },
						programs: [{ programId: 5, staffId: 11, title: { es: 'Coord' } }],
					},
				],
			});
			await expect(
				ChartHeadsValidation.validateConfigure(mockRepo as any, dto),
			).resolves.toBeUndefined();
			expect(mockRepo.findMissingProgramIds).toHaveBeenCalledWith([5]);
			expect(mockRepo.findMissingStaffIds).toHaveBeenCalledWith([9, 10, 11]);
			expect(mockRepo.findProgramsConfiguredForOtherSchool).toHaveBeenCalledWith([5], 1, 3);
		});

		it('throws when the same programId is repeated across two directors', async () => {
			const dto = makeDto({
				directors: [
					{
						schoolId: 3,
						staffId: 10,
						title: { es: 'x' },
						programs: [{ programId: 5, staffId: 11, title: { es: 'a' } }],
					},
					{
						schoolId: 4,
						staffId: 12,
						title: { es: 'y' },
						programs: [{ programId: 5, staffId: 13, title: { es: 'b' } }],
					},
				],
			});
			await expect(ChartHeadsValidation.validateConfigure(mockRepo as any, dto)).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when a programId does not exist', async () => {
			mockRepo.findMissingProgramIds.mockResolvedValue([5]);
			const dto = makeDto({
				directors: [
					{
						schoolId: 3,
						staffId: 10,
						title: { es: 'Dir' },
						programs: [{ programId: 5, staffId: 11, title: { es: 'Coord' } }],
					},
				],
			});
			await expect(ChartHeadsValidation.validateConfigure(mockRepo as any, dto)).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when a program is already configured for a different school', async () => {
			mockRepo.findProgramsConfiguredForOtherSchool.mockResolvedValue([5]);
			const dto = makeDto({
				directors: [
					{
						schoolId: 3,
						staffId: 10,
						title: { es: 'Dir' },
						programs: [{ programId: 5, staffId: 11, title: { es: 'Coord' } }],
					},
				],
			});
			await expect(ChartHeadsValidation.validateConfigure(mockRepo as any, dto)).rejects.toThrow(
				DomainError,
			);
		});

		it('passes re-configuring a program already assigned to the same school', async () => {
			mockRepo.findProgramsConfiguredForOtherSchool.mockResolvedValue([]);
			const dto = makeDto({
				directors: [
					{
						schoolId: 3,
						staffId: 10,
						title: { es: 'Dir' },
						programs: [{ programId: 5, staffId: 11, title: { es: 'Coord' } }],
					},
				],
			});
			await expect(
				ChartHeadsValidation.validateConfigure(mockRepo as any, dto),
			).resolves.toBeUndefined();
		});

		it('throws when a program coordinator staff does not exist', async () => {
			mockRepo.findMissingStaffIds.mockResolvedValue([11]);
			const dto = makeDto({
				directors: [
					{
						schoolId: 3,
						staffId: 10,
						title: { es: 'Dir' },
						programs: [{ programId: 5, staffId: 11, title: { es: 'Coord' } }],
					},
				],
			});
			await expect(ChartHeadsValidation.validateConfigure(mockRepo as any, dto)).rejects.toThrow(
				DomainError,
			);
		});

		it('skips the per-school program conflict check for directors with no programs', async () => {
			const dto = makeDto();
			await ChartHeadsValidation.validateConfigure(mockRepo as any, dto);
			expect(mockRepo.findProgramsConfiguredForOtherSchool).not.toHaveBeenCalled();
		});
	});
});
