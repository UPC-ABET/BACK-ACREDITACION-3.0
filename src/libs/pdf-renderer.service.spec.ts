import { ConfigService } from '@nestjs/config';
import { PdfRendererService } from './pdf-renderer.service';
import { reportRenderStrings } from './strings/report-render.strings';

/**
 * `getBrowser()` loads puppeteer through a dynamic `import()`, which Jest's default (non-ESM) VM
 * cannot intercept with `jest.mock('puppeteer', ...)` -- it throws
 * `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG` before ever reaching the mock. Stubbing the
 * `getBrowser` seam instead keeps every other path real: the ConcurrencyGate wiring, the
 * per-step Chromium timeouts, browser recycling, and the error-to-i18n-key mapping in
 * `toHttpError` -- the logic this hotfix actually changed.
 */
const deferred = <T = void>() => {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

interface FakeBrowser {
	connected: boolean;
	newPage: jest.Mock;
	close: jest.Mock;
	on: jest.Mock;
	process: jest.Mock;
}

const makeBrowser = (): FakeBrowser => ({
	connected: true,
	newPage: jest.fn(),
	close: jest.fn().mockResolvedValue(undefined),
	on: jest.fn(),
	process: jest.fn(() => ({ kill: jest.fn() })),
});

const makePage = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
	setContent: jest.fn().mockResolvedValue(undefined),
	emulateMediaType: jest.fn().mockResolvedValue(undefined),
	pdf: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
	close: jest.fn().mockResolvedValue(undefined),
	...overrides,
});

const configWith = (overrides: Record<string, string> = {}): ConfigService =>
	({ get: jest.fn((key: string) => overrides[key]) }) as unknown as ConfigService;

const stubGetBrowser = (service: PdfRendererService, browser: FakeBrowser) =>
	jest
		.spyOn(service as unknown as { getBrowser: () => Promise<FakeBrowser> }, 'getBrowser')
		.mockResolvedValue(browser);

describe('PdfRendererService', () => {
	it('renders a PDF and releases the concurrency permit', async () => {
		const service = new PdfRendererService(configWith());
		const browser = makeBrowser();
		browser.newPage.mockResolvedValue(makePage());
		stubGetBrowser(service, browser);

		const pdf = await service.htmlToPdf('<html></html>');

		expect(pdf).toBeInstanceOf(Buffer);
	});

	it('queues a render past the concurrency limit and only runs it once a slot frees up', async () => {
		const service = new PdfRendererService(configWith({ REPORT_RENDER_CONCURRENCY: '1' }));
		const browser = makeBrowser();
		const stuck = deferred<Uint8Array>();
		const firstPage = makePage({ pdf: jest.fn().mockReturnValue(stuck.promise) });
		const secondPage = makePage();
		browser.newPage.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);
		stubGetBrowser(service, browser);

		const firstRender = service.htmlToPdf('<a/>');
		await flush();
		const secondRender = service.htmlToPdf('<b/>');
		await flush();
		expect(secondPage.pdf).not.toHaveBeenCalled();

		stuck.resolve(new Uint8Array([1]));
		await firstRender;
		await secondRender;

		expect(secondPage.pdf).toHaveBeenCalledTimes(1);
	});

	it('rejects with the timeout key once REPORT_RENDER_QUEUE_TIMEOUT_MS elapses on a full gate', async () => {
		const service = new PdfRendererService(
			configWith({ REPORT_RENDER_CONCURRENCY: '1', REPORT_RENDER_QUEUE_TIMEOUT_MS: '20' }),
		);
		const browser = makeBrowser();
		const stuck = deferred<Uint8Array>();
		const stuckPage = makePage({ pdf: jest.fn().mockReturnValue(stuck.promise) });
		browser.newPage.mockResolvedValueOnce(stuckPage);
		stubGetBrowser(service, browser);

		const held = service.htmlToPdf('<a/>');
		await flush();

		await expect(service.htmlToPdf('<b/>')).rejects.toMatchObject({
			status: 503,
			message: reportRenderStrings.error.timeout,
		});

		stuck.resolve(new Uint8Array([1]));
		await held;
	});

	it('rejects with the render-timeout key and recycles the browser when a Chromium step hangs', async () => {
		const service = new PdfRendererService(configWith({ REPORT_RENDER_TIMEOUT_MS: '20' }));
		const browser = makeBrowser();
		const hungPage = makePage({ setContent: jest.fn(() => new Promise(() => undefined)) });
		browser.newPage.mockResolvedValue(hungPage);
		stubGetBrowser(service, browser);

		await expect(service.htmlToPdf('<a/>')).rejects.toMatchObject({
			status: 503,
			message: reportRenderStrings.error.timeout,
		});

		expect(browser.close).toHaveBeenCalledTimes(1);
	});

	it('rejects with the unavailable key on an unrelated render failure, without recycling a healthy browser', async () => {
		const service = new PdfRendererService(configWith());
		const browser = makeBrowser();
		const page = makePage({ pdf: jest.fn().mockRejectedValue(new Error('boom')) });
		browser.newPage.mockResolvedValue(page);
		stubGetBrowser(service, browser);

		await expect(service.htmlToPdf('<a/>')).rejects.toMatchObject({
			status: 503,
			message: reportRenderStrings.error.unavailable,
		});

		expect(browser.close).not.toHaveBeenCalled();
	});

	it('refuses new renders once shutting down, without acquiring a browser', async () => {
		const service = new PdfRendererService(configWith());
		const browser = makeBrowser();
		const getBrowserSpy = stubGetBrowser(service, browser);
		await service.onModuleDestroy();

		await expect(service.htmlToPdf('<a/>')).rejects.toMatchObject({
			status: 503,
			message: reportRenderStrings.error.unavailable,
		});
		expect(getBrowserSpy).not.toHaveBeenCalled();
	});
});
