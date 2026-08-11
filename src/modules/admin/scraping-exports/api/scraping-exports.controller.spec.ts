import { ConflictException } from '@nestjs/common';
import { PassThrough } from 'node:stream';

import { ScrapingExportsController } from './scraping-exports.controller';
import { ScrapingExportsService } from './scraping-exports.service';

// Each grades RC export pins a pooled connection and one run of the cross-scrape merge for the
// minutes it takes, against a Postgres shared with the application database -- so the admission
// guard is what keeps one user's download from slowing the API down for everyone. These pin it,
// including all three release paths: a guard that never clears is a permanent 409 until restart.
describe('ScrapingExportsController.gradesRc — one export at a time', () => {
	const prepareGradesRc = jest.fn();
	const controller = new ScrapingExportsController({
		prepareGradesRc,
	} as unknown as ScrapingExportsService);

	// Enough of an express Response for the controller: header sink + writable stream.
	const fakeResponse = () => {
		const stream = new PassThrough();
		stream.resume();
		Object.assign(stream, { setHeader: jest.fn(), destroy: jest.fn() });
		return stream as never;
	};

	// What prepareGradesRc hands the controller: a file name, a writer, and the release for the
	// pooled connection the scratch table sits on.
	const prepared = (over: Record<string, unknown> = {}) => ({
		fileName: 'NotasRC.xlsx',
		write: jest.fn().mockResolvedValue(undefined),
		close: jest.fn().mockResolvedValue(undefined),
		...over,
	});

	beforeEach(() => jest.clearAllMocks());

	it('lets a second export through once the first has finished', async () => {
		prepareGradesRc.mockResolvedValue(prepared());

		await controller.gradesRc('es', 1, fakeResponse());
		await controller.gradesRc('es', 1, fakeResponse());

		expect(prepareGradesRc).toHaveBeenCalledTimes(2);
	});

	it('refuses a second export while the first is still running', async () => {
		let releaseFirst!: () => void;
		prepareGradesRc.mockImplementation(() =>
			Promise.resolve(
				prepared({ write: () => new Promise<void>((resolve) => (releaseFirst = resolve)) }),
			),
		);

		const first = controller.gradesRc('es', 1, fakeResponse());
		// Let the first request reach its write() before the second one arrives.
		await Promise.resolve();

		await expect(controller.gradesRc('es', 1, fakeResponse())).rejects.toBeInstanceOf(
			ConflictException,
		);

		releaseFirst();
		await first;
	});

	// The query runs before any header goes out, so this failure is a normal error response -- but it
	// still has to release the guard on the way out.
	it('releases the guard when building the rows fails', async () => {
		prepareGradesRc.mockRejectedValueOnce(new Error('query failed'));

		await expect(controller.gradesRc('es', 1, fakeResponse())).rejects.toThrow('query failed');

		prepareGradesRc.mockResolvedValueOnce(prepared());
		await controller.gradesRc('es', 1, fakeResponse());

		expect(prepareGradesRc).toHaveBeenCalledTimes(2);
	});

	// A failure mid-download is swallowed on purpose (the socket is destroyed instead), so nothing
	// throws here -- which is exactly why the release has to be in a finally rather than after it.
	it('releases the guard when the download fails midway', async () => {
		const res = fakeResponse();
		const closeAfterFailure = jest.fn().mockResolvedValue(undefined);
		prepareGradesRc.mockResolvedValueOnce(
			prepared({
				write: jest.fn().mockRejectedValue(new Error('stream died')),
				close: closeAfterFailure,
			}),
		);

		await controller.gradesRc('es', 1, res);

		expect((res as unknown as { destroy: jest.Mock }).destroy).toHaveBeenCalled();
		// The scratch table and its pooled connection have to go back even when the download died.
		expect(closeAfterFailure).toHaveBeenCalled();

		prepareGradesRc.mockResolvedValueOnce(prepared());
		await controller.gradesRc('es', 1, fakeResponse());

		expect(prepareGradesRc).toHaveBeenCalledTimes(2);
	});
});
