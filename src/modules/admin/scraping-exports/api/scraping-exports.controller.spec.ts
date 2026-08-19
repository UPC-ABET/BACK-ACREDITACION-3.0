import { ScrapingExportsController } from './scraping-exports.controller';
import { ScrapingExportsService } from './scraping-exports.service';

describe('ScrapingExportsController — grades RC job endpoints', () => {
	const startGradesRcExport = jest.fn();
	const getGradesRcStatus = jest.fn();
	const getGradesRcFile = jest.fn();
	const controller = new ScrapingExportsController({
		startGradesRcExport,
		getGradesRcStatus,
		getGradesRcFile,
	} as unknown as ScrapingExportsService);

	const fakeResponse = () => ({ setHeader: jest.fn(), end: jest.fn() }) as never;
	const user = { userId: 7 } as never;

	beforeEach(() => jest.clearAllMocks());

	it('starts a job for the current user and returns it wrapped as a success response', async () => {
		startGradesRcExport.mockResolvedValue({ accepted: true, jobId: 'job-1' });

		const response = await controller.gradesRcStart('es', 1, user);

		expect(startGradesRcExport).toHaveBeenCalledWith(1, 'es', 7);
		expect(response.data).toEqual({ accepted: true, jobId: 'job-1' });
	});

	it('polls status for the current user', async () => {
		getGradesRcStatus.mockReturnValue({ status: 'running', done: false });

		const response = await controller.gradesRcStatus('job-1', user);

		expect(getGradesRcStatus).toHaveBeenCalledWith('job-1', 7);
		expect(response.data).toEqual({ status: 'running', done: false });
	});

	it('streams the finished file with download headers', async () => {
		getGradesRcFile.mockReturnValue({
			buffer: Buffer.from('xlsx-bytes'),
			fileName: 'NotasRC.xlsx',
		});
		const res = fakeResponse();

		await controller.gradesRcDownload('job-1', user, res);

		expect(getGradesRcFile).toHaveBeenCalledWith('job-1', 7);
		expect((res as unknown as { setHeader: jest.Mock }).setHeader).toHaveBeenCalledWith(
			'Content-Disposition',
			expect.stringContaining('NotasRC.xlsx'),
		);
		expect((res as unknown as { end: jest.Mock }).end).toHaveBeenCalledWith(
			Buffer.from('xlsx-bytes'),
		);
	});
});
