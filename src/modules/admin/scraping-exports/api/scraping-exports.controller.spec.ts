import { BadRequestError, NotFoundError } from 'src/commons/domain-error';

import { ScrapingExportsController } from './scraping-exports.controller';
import { ScrapingExportGenerationService } from './scraping-export-generation.service';
import { scrapingExportsValidationStrings } from '../config/strings/scraping-exports.validation';

describe('ScrapingExportsController', () => {
	const getStatus = jest.fn();
	const download = jest.fn();
	const regenerate = jest.fn();
	const resolvePeriod = jest.fn();

	const controller = new ScrapingExportsController({
		getStatus,
		download,
		regenerate,
		resolvePeriod,
	} as unknown as ScrapingExportGenerationService);

	const fakeResponse = () => ({ setHeader: jest.fn(), end: jest.fn() }) as never;
	const user = { userId: 7 } as never;

	beforeEach(() => {
		jest.clearAllMocks();
		resolvePeriod.mockResolvedValue('202610');
	});

	describe('status', () => {
		it('resolves exportType and period, and returns the service result wrapped, without a lang', async () => {
			getStatus.mockResolvedValue({ status: 'completed' });

			const response = await controller.status('enrolled-students', 1);

			expect(resolvePeriod).toHaveBeenCalledWith(1);
			expect(getStatus).toHaveBeenCalledWith('enrolledStudents', '202610');
			expect(response.data).toEqual({ status: 'completed' });
		});

		it('rejects an exportType outside the fixed set', async () => {
			await expect(controller.status('bogus', 1)).rejects.toThrow(BadRequestError);
			expect(getStatus).not.toHaveBeenCalled();
		});

		it('throws NotFoundError when the academic period cannot be resolved to a period', async () => {
			resolvePeriod.mockResolvedValue(null);

			await expect(controller.status('staff', 999)).rejects.toThrow(NotFoundError);
			expect(getStatus).not.toHaveBeenCalled();
		});
	});

	describe('download', () => {
		it('streams the file with download headers when a result exists', async () => {
			download.mockResolvedValue({
				fileName: 'Docentes.xlsx',
				buffer: Buffer.from('xlsx-bytes'),
			});
			const res = fakeResponse();

			await controller.download('staff', 'es', 1, res);

			expect(download).toHaveBeenCalledWith('staff', '202610', 'es');
			expect((res as unknown as { setHeader: jest.Mock }).setHeader).toHaveBeenCalledWith(
				'Content-Type',
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			);
			expect((res as unknown as { setHeader: jest.Mock }).setHeader).toHaveBeenCalledWith(
				'Content-Disposition',
				expect.stringContaining('Docentes.xlsx'),
			);
			expect((res as unknown as { end: jest.Mock }).end).toHaveBeenCalledWith(
				Buffer.from('xlsx-bytes'),
			);
		});

		it('defaults lang to "es" when not provided', async () => {
			download.mockResolvedValue({ fileName: 'Docentes.xlsx', buffer: Buffer.from('x') });

			await controller.download('staff', undefined as unknown as string, 1, fakeResponse());

			expect(download).toHaveBeenCalledWith('staff', '202610', 'es');
		});

		it('renders a different language from the same generation, without any extra service call shape', async () => {
			download.mockResolvedValue({ fileName: 'Professors.xlsx', buffer: Buffer.from('x') });

			await controller.download('staff', 'en', 1, fakeResponse());

			expect(download).toHaveBeenCalledWith('staff', '202610', 'en');
		});

		it('throws NotFoundError instead of streaming when nothing has ever been generated', async () => {
			download.mockResolvedValue(null);
			const res = fakeResponse();

			await expect(controller.download('staff', 'es', 1, res)).rejects.toThrow(NotFoundError);
			await expect(controller.download('staff', 'es', 1, res)).rejects.toMatchObject({
				messageKey: scrapingExportsValidationStrings.error.notGenerated,
			});
			expect((res as unknown as { end: jest.Mock }).end).not.toHaveBeenCalled();
		});
	});

	describe('regenerate', () => {
		it('triggers regeneration as the current user, without a lang, and returns the row wrapped', async () => {
			regenerate.mockResolvedValue({ status: 'running' });

			const response = await controller.regenerate('grades-rc', 1, user);

			expect(regenerate).toHaveBeenCalledWith('gradesRc', '202610', 'user:7');
			expect(response.data).toEqual({ status: 'running' });
		});

		it('propagates a ConflictError thrown by the service as-is', async () => {
			const conflict = new Error('already generating');
			regenerate.mockRejectedValue(conflict);

			await expect(controller.regenerate('staff', 1, user)).rejects.toBe(conflict);
		});
	});
});
