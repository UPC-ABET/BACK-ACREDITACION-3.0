import { ScrapingExportRunRepository } from './scraping-export-run.repository';
import { ScrapingExportRunEntity } from '../model/scraping-export-run.entity';

describe('ScrapingExportRunRepository', () => {
	const mockTypeormRepository = {
		findOne: jest.fn(),
		upsert: jest.fn(),
	};
	const repo = new ScrapingExportRunRepository(mockTypeormRepository as any, undefined as any);

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('findByKey', () => {
		it('returns null when no row exists for the key', async () => {
			mockTypeormRepository.findOne.mockResolvedValue(null);

			const result = await repo.findByKey('staff', '202610');

			expect(result).toBeNull();
			expect(mockTypeormRepository.findOne).toHaveBeenCalledWith({
				where: { exportType: 'staff', period: '202610' },
			});
		});

		it('returns the row when one exists for the key', async () => {
			const row = { id: 1, exportType: 'staff', period: '202610' };
			mockTypeormRepository.findOne.mockResolvedValue(row);

			await expect(repo.findByKey('staff', '202610')).resolves.toEqual(row);
		});
	});

	describe('upsertByKey', () => {
		it('creates a new row on the first call for a key', async () => {
			mockTypeormRepository.upsert.mockResolvedValue(undefined);
			const created: Partial<ScrapingExportRunEntity> = {
				id: 1,
				exportType: 'staff',
				period: '202610',
				status: 'running',
			};
			mockTypeormRepository.findOne.mockResolvedValue(created);

			const result = await repo.upsertByKey('staff', '202610', { status: 'running' });

			expect(mockTypeormRepository.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					exportType: 'staff',
					period: '202610',
					status: 'running',
				}),
				{ conflictPaths: ['exportType', 'period'] },
			);
			expect(result).toEqual(created);
		});

		it('updates the same row (same id) on a second call with the same key', async () => {
			mockTypeormRepository.upsert.mockResolvedValue(undefined);
			mockTypeormRepository.findOne.mockResolvedValue({
				id: 1,
				exportType: 'staff',
				period: '202610',
				status: 'completed',
				rowsData: [{ professor_code: 'N001' }],
			});

			const result = await repo.upsertByKey('staff', '202610', {
				status: 'completed',
				rowsData: [{ professor_code: 'N001' }],
			});

			expect(result.id).toBe(1);
			expect(result.status).toBe('completed');
			expect(result.rowsData).toEqual([{ professor_code: 'N001' }]);
		});

		it('throws when the row cannot be found back after the upsert', async () => {
			mockTypeormRepository.upsert.mockResolvedValue(undefined);
			mockTypeormRepository.findOne.mockResolvedValue(null);

			await expect(repo.upsertByKey('staff', '202610', { status: 'running' })).rejects.toThrow();
		});
	});
});
