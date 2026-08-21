import { Not } from 'typeorm';
import { PlannerScrapeRunRepository } from './planner-scrape-run.repository';

describe('PlannerScrapeRunRepository', () => {
	const mockTypeormRepository = { delete: jest.fn(), update: jest.fn() };
	const repo = new PlannerScrapeRunRepository(mockTypeormRepository as any);

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('deleteRun', () => {
		it('deletes the run by id', async () => {
			await repo.deleteRun('run-1');

			expect(mockTypeormRepository.delete).toHaveBeenCalledWith('run-1');
		});
	});

	describe('deleteOtherRunsForPeriod', () => {
		it('deletes every run for the period except the one to keep', async () => {
			await repo.deleteOtherRunsForPeriod('202610', 'run-keep');

			expect(mockTypeormRepository.delete).toHaveBeenCalledWith({
				period: '202610',
				id: Not('run-keep'),
			});
		});

		it('scopes each call to its own period and keepRunId, never mixing them', async () => {
			await repo.deleteOtherRunsForPeriod('202610', 'run-keep-1');
			await repo.deleteOtherRunsForPeriod('202620', 'run-keep-2');

			expect(mockTypeormRepository.delete).toHaveBeenNthCalledWith(1, {
				period: '202610',
				id: Not('run-keep-1'),
			});
			expect(mockTypeormRepository.delete).toHaveBeenNthCalledWith(2, {
				period: '202620',
				id: Not('run-keep-2'),
			});
		});
	});

	describe('updatePhase', () => {
		it('updates the run phase by id', async () => {
			await repo.updatePhase('run-1', 'evaluations');

			expect(mockTypeormRepository.update).toHaveBeenCalledWith('run-1', {
				phase: 'evaluations',
			});
		});
	});

	describe('finish', () => {
		it('clears phase to null once the run reaches a terminal status', async () => {
			await repo.finish('run-1', 'completed', { counts: { seccion: 1 } });

			expect(mockTypeormRepository.update).toHaveBeenCalledWith(
				'run-1',
				expect.objectContaining({ phase: null }),
			);
		});
	});
});
