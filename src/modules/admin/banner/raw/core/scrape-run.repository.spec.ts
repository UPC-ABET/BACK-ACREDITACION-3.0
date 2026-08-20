import { Not } from 'typeorm';
import { ScrapeRunRepository } from './scrape-run.repository';

describe('ScrapeRunRepository', () => {
	const mockTypeormRepository = { delete: jest.fn() };
	const repo = new ScrapeRunRepository(mockTypeormRepository as any);

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('deleteRun', () => {
		it('deletes the run by id', async () => {
			await repo.deleteRun('run-1');

			expect(mockTypeormRepository.delete).toHaveBeenCalledWith('run-1');
		});
	});

	describe('deleteOtherRunsForPeriodo', () => {
		it('deletes every run for the periodo except the one to keep', async () => {
			await repo.deleteOtherRunsForPeriodo('202610', 'run-keep');

			expect(mockTypeormRepository.delete).toHaveBeenCalledWith({
				periodo: '202610',
				id: Not('run-keep'),
			});
		});

		it('does not touch rows for a different periodo', async () => {
			await repo.deleteOtherRunsForPeriodo('202610', 'run-keep');

			const [criteria] = mockTypeormRepository.delete.mock.calls[0];
			expect(criteria.periodo).toBe('202610');
			expect(criteria.periodo).not.toBe('202620');
		});
	});
});
