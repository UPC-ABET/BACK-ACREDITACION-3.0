import { BadRequestError, NotFoundError } from 'src/commons/domain-error';

import { ScrapingExportsController } from './scraping-exports.controller';
import { ScrapingExportGenerationService } from './scraping-export-generation.service';
import { scrapingExportsValidationStrings } from '../config/strings/scraping-exports.validation';

describe('ScrapingExportsController', () => {
	const getStatus = jest.fn();
	const download = jest.fn();
	const regenerate = jest.fn();
	const resolvePeriodo = jest.fn();

	const controller = new ScrapingExportsController({
		getStatus,
		download,
		regenerate,
		resolvePeriodo,
	} as unknown as ScrapingExportGenerationService);

	const fakeResponse = () => ({ setHeader: jest.fn(), end: jest.fn() }) as never;
	const user = { userId: 7 } as never;

	beforeEach(() => {
		jest.clearAllMocks();
		resolvePeriodo.mockResolvedValue('202610');
	});

	describe('status', () => {
		it('resolves exportType and periodo, and returns the service result wrapped', async () => {
			getStatus.mockResolvedValue({ status: 'completed' });

			const response = await controller.status('alumnos-matriculados', 'es', 1);

			expect(resolvePeriodo).toHaveBeenCalledWith(1);
			expect(getStatus).toHaveBeenCalledWith('alumnosMatriculados', '202610', 'es');
			expect(response.data).toEqual({ status: 'completed' });
		});

		it('defaults lang to "es" when not provided', async () => {
			getStatus.mockResolvedValue({ status: 'notGenerated' });

			await controller.status('docentes', undefined as unknown as string, 1);

			expect(getStatus).toHaveBeenCalledWith('docentes', '202610', 'es');
		});

		it('rejects an exportType outside the fixed set', async () => {
			await expect(controller.status('bogus', 'es', 1)).rejects.toThrow(BadRequestError);
			expect(getStatus).not.toHaveBeenCalled();
		});

		it('throws NotFoundError when the academic period cannot be resolved to a periodo', async () => {
			resolvePeriodo.mockResolvedValue(null);

			await expect(controller.status('docentes', 'es', 999)).rejects.toThrow(NotFoundError);
			expect(getStatus).not.toHaveBeenCalled();
		});
	});

	describe('download', () => {
		it('streams the file with download headers when a result exists', async () => {
			download.mockResolvedValue({
				fileName: 'Docentes.xlsx',
				fileBytes: Buffer.from('xlsx-bytes'),
			});
			const res = fakeResponse();

			await controller.download('docentes', 'es', 1, res);

			expect(download).toHaveBeenCalledWith('docentes', '202610', 'es');
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

		it('throws NotFoundError instead of streaming when nothing has ever been generated', async () => {
			download.mockResolvedValue(null);
			const res = fakeResponse();

			await expect(controller.download('docentes', 'es', 1, res)).rejects.toThrow(NotFoundError);
			await expect(controller.download('docentes', 'es', 1, res)).rejects.toMatchObject({
				messageKey: scrapingExportsValidationStrings.error.notGenerated,
			});
			expect((res as unknown as { end: jest.Mock }).end).not.toHaveBeenCalled();
		});
	});

	describe('regenerate', () => {
		it('triggers regeneration as the current user and returns the row wrapped', async () => {
			regenerate.mockResolvedValue({ status: 'running' });

			const response = await controller.regenerate('grades-rc', 'es', 1, user);

			expect(regenerate).toHaveBeenCalledWith('gradesRc', '202610', 'es', 'user:7');
			expect(response.data).toEqual({ status: 'running' });
		});

		it('propagates a ConflictError thrown by the service as-is', async () => {
			const conflict = new Error('already generating');
			regenerate.mockRejectedValue(conflict);

			await expect(controller.regenerate('docentes', 'es', 1, user)).rejects.toBe(conflict);
		});
	});
});
