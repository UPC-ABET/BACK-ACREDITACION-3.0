import { DomainError } from 'src/commons/domain-error';
import { GraConfigService } from './gra-config.service';

const mockConfigRepo = {
	findExistingGra: jest.fn(),
	create: jest.fn(),
	update: jest.fn(),
};

const mockAcceptanceLevelService = {};

describe('GraConfigService', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('create', () => {
		const dto = {
			outcomeId: 1,
			nameEs: 'Comunicación',
			programId: 8,
		} as any;

		it('creates a new row when no config exists yet for the (outcome, program, period)', async () => {
			mockConfigRepo.findExistingGra.mockResolvedValue(null);
			mockConfigRepo.create.mockResolvedValue({ id: 10, isActive: true });

			const service = new GraConfigService(
				mockConfigRepo as any,
				mockAcceptanceLevelService as any,
			);
			await service.create(dto, 3);

			expect(mockConfigRepo.create).toHaveBeenCalledTimes(1);
			expect(mockConfigRepo.update).not.toHaveBeenCalled();
			expect(mockConfigRepo.create.mock.calls[0][0]).toMatchObject({
				outcomeId: 1,
				isActive: true,
			});
		});

		it('reactivates a previously soft-deleted row instead of erroring', async () => {
			mockConfigRepo.findExistingGra.mockResolvedValue({ id: 42, isActive: false });
			mockConfigRepo.update.mockResolvedValue({ id: 42, isActive: true });

			const service = new GraConfigService(
				mockConfigRepo as any,
				mockAcceptanceLevelService as any,
			);
			const result = await service.create(dto, 3);

			expect(mockConfigRepo.update).toHaveBeenCalledWith(
				42,
				expect.objectContaining({ outcomeId: 1, isActive: true }),
			);
			expect(mockConfigRepo.create).not.toHaveBeenCalled();
			expect(result).toEqual({ id: 42, isActive: true });
		});

		it('throws when an active duplicate already exists for the (outcome, program, period)', async () => {
			mockConfigRepo.findExistingGra.mockResolvedValue({ id: 7, isActive: true });

			const service = new GraConfigService(
				mockConfigRepo as any,
				mockAcceptanceLevelService as any,
			);

			await expect(service.create(dto, 3)).rejects.toThrow(DomainError);
			expect(mockConfigRepo.create).not.toHaveBeenCalled();
			expect(mockConfigRepo.update).not.toHaveBeenCalled();
		});
	});
});
