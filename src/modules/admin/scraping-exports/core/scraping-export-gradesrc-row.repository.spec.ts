import { MoreThan } from 'typeorm';

import { ScrapingExportGradesRcRowRepository } from './scraping-export-gradesrc-row.repository';
import { GradeRcExportRow } from '../model/scraping-exports.types';

const row = (
	over: Partial<GradeRcExportRow> = {},
): GradeRcExportRow & { hasObservations: boolean } =>
	({
		sectionCode: 'NRC1',
		studentCode: 'A1',
		gradeTypeCode: 'TG205-T001',
		gradeTypePercentage: '20',
		grade: '14.80',
		qualificationStatusCode: 'TG404-T001',
		academicPeriod: '202610',
		courseCode: '1ASI0725',
		courseName: 'Arquitectura de Computadoras',
		studentName: 'Anahua Ancachi, Liz Maribel',
		careerCode: 'SW',
		gradeTypeName: 'EA1',
		qualificationStatusName: 'Asistió',
		source: 'Banner',
		scrapedAt: '2026-08-08 16:20',
		observations: [],
		hasObservations: false,
		...over,
	}) as GradeRcExportRow & { hasObservations: boolean };

describe('ScrapingExportGradesRcRowRepository', () => {
	const mockTypeormRepository = {
		insert: jest.fn(),
		find: jest.fn(),
		count: jest.fn(),
		createQueryBuilder: jest.fn(),
	};
	const repo = new ScrapingExportGradesRcRowRepository(mockTypeormRepository as any);
	const GENERATED_AT = new Date('2026-08-22T00:00:00Z');

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('insertBatch', () => {
		it('inserts everything in one statement when the batch fits in one chunk', async () => {
			mockTypeormRepository.insert.mockResolvedValue(undefined);
			const rows = [row(), row({ sectionCode: 'NRC2' })];

			await repo.insertBatch(42, GENERATED_AT, rows);

			expect(mockTypeormRepository.insert).toHaveBeenCalledTimes(1);
			const [chunk] = mockTypeormRepository.insert.mock.calls[0];
			expect(chunk).toHaveLength(2);
			expect(chunk[0]).toMatchObject({
				scrapingExportRunId: 42,
				generatedAt: GENERATED_AT,
				sectionCode: 'NRC1',
			});
		});

		// Chunk boundary: exactly 1,000 rows (INSERT_BATCH_SIZE) must still be one statement; 1,001
		// must split into two.
		it('splits into 1,000-row chunks once the batch crosses the boundary', async () => {
			mockTypeormRepository.insert.mockResolvedValue(undefined);
			const rows = Array.from({ length: 1001 }, (_, i) => row({ sectionCode: `NRC${i}` }));

			await repo.insertBatch(42, GENERATED_AT, rows);

			expect(mockTypeormRepository.insert).toHaveBeenCalledTimes(2);
			const chunkSizes = mockTypeormRepository.insert.mock.calls.map(([chunk]) => chunk.length);
			expect(chunkSizes).toEqual([1000, 1]);
		});

		it('does not insert anything for an exactly-1,000-row batch beyond the single statement', async () => {
			mockTypeormRepository.insert.mockResolvedValue(undefined);
			const rows = Array.from({ length: 1000 }, (_, i) => row({ sectionCode: `NRC${i}` }));

			await repo.insertBatch(42, GENERATED_AT, rows);

			expect(mockTypeormRepository.insert).toHaveBeenCalledTimes(1);
		});
	});

	describe('readPage', () => {
		it('reads the first page without an id cursor', async () => {
			mockTypeormRepository.find.mockResolvedValue([]);

			await repo.readPage(42, GENERATED_AT, false, 0, 500);

			expect(mockTypeormRepository.find).toHaveBeenCalledWith({
				where: { scrapingExportRunId: 42, generatedAt: GENERATED_AT, hasObservations: false },
				order: { id: 'ASC' },
				take: 500,
			});
		});

		it('adds a MoreThan(afterId) cursor once paging past the first page', async () => {
			mockTypeormRepository.find.mockResolvedValue([]);

			await repo.readPage(42, GENERATED_AT, true, 100, 500);

			const [call] = mockTypeormRepository.find.mock.calls[0];
			expect(call.where).toMatchObject({
				scrapingExportRunId: 42,
				generatedAt: GENERATED_AT,
				hasObservations: true,
			});
			expect(call.where.id).toEqual(MoreThan(100));
		});

		it('scopes the read to the given generatedAt, not just the run id', async () => {
			mockTypeormRepository.find.mockResolvedValue([]);
			const otherGeneratedAt = new Date('2026-08-01T00:00:00Z');

			await repo.readPage(42, otherGeneratedAt, false, 0, 500);

			const [call] = mockTypeormRepository.find.mock.calls[0];
			expect(call.where.generatedAt).toBe(otherGeneratedAt);
		});
	});

	describe('hasRows', () => {
		it('returns true when the count is positive', async () => {
			mockTypeormRepository.count.mockResolvedValue(1);

			await expect(repo.hasRows(42, GENERATED_AT)).resolves.toBe(true);
			expect(mockTypeormRepository.count).toHaveBeenCalledWith({
				where: { scrapingExportRunId: 42, generatedAt: GENERATED_AT },
				take: 1,
			});
		});

		it('returns false when the count is zero', async () => {
			mockTypeormRepository.count.mockResolvedValue(0);

			await expect(repo.hasRows(42, GENERATED_AT)).resolves.toBe(false);
		});
	});

	describe('deleteStaleBatches', () => {
		it('deletes every row for the run id except the batch being kept', async () => {
			const execute = jest.fn().mockResolvedValue(undefined);
			const andWhere = jest.fn().mockReturnValue({ execute });
			const where = jest.fn().mockReturnValue({ andWhere });
			const del = jest.fn().mockReturnValue({ where });
			mockTypeormRepository.createQueryBuilder.mockReturnValue({ delete: del });

			await repo.deleteStaleBatches(42, GENERATED_AT);

			expect(where).toHaveBeenCalledWith('scraping_export_run_id = :scrapingExportRunId', {
				scrapingExportRunId: 42,
			});
			expect(andWhere).toHaveBeenCalledWith('generated_at <> :keepGeneratedAt', {
				keepGeneratedAt: GENERATED_AT,
			});
			expect(execute).toHaveBeenCalledTimes(1);
		});
	});
});
