import { ConfigService } from '@nestjs/config';
import { BannerTokenService } from '../../banner-token/api/banner-token.service';
import { BannerHttpClient, BannerHttpError } from './banner-http.client';

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
	ok: status >= 200 && status < 300,
	status,
	headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
	json: async () => body,
	text: async () => JSON.stringify(body),
});

const fetchMock = jest.fn();

const buildClient = (forceRefreshToken = 'refreshed-token') => {
	const tokenService = {
		getValidToken: jest.fn((force?: boolean) =>
			Promise.resolve(force ? forceRefreshToken : 'token'),
		),
	};
	const config = { get: () => undefined, getOrThrow: () => 'api-key' };
	const client = new BannerHttpClient(
		config as unknown as ConfigService,
		tokenService as unknown as BannerTokenService,
	);
	return { client, tokenService };
};

describe('BannerHttpClient', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		fetchMock.mockReset();
		global.fetch = fetchMock as unknown as typeof fetch;
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('returns the parsed JSON body on success', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { detalle: [{ id: 1 }] }));

		await expect(buildClient().client.get('/horario', {})).resolves.toEqual({
			detalle: [{ id: 1 }],
		});
	});

	it('re-authenticates once on a 401 and retries with the refreshed token', async () => {
		fetchMock
			.mockResolvedValueOnce(jsonResponse(401, {}))
			.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
		const { client, tokenService } = buildClient();

		await expect(client.get('/horario', {})).resolves.toEqual({ ok: true });

		expect(tokenService.getValidToken).toHaveBeenCalledWith(true);
		const secondCallHeaders = fetchMock.mock.calls[1][1].headers as Record<string, string>;
		expect(secondCallHeaders.Authorization).toBe('Bearer refreshed-token');
	});

	it('throws immediately on a non-retryable status without waiting', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(400, { cabecera: { mensajeRespuesta: 'nope' } }));

		await expect(buildClient().client.get('/horario', {})).rejects.toThrow(BannerHttpError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	describe('retryable statuses (5xx and 429)', () => {
		it.each([500, 502, 503, 429])(
			'retries on %i up to the retry limit, then succeeds',
			async (status) => {
				jest.useFakeTimers();
				jest.spyOn(Math, 'random').mockReturnValue(0); // zero jitter — resolves instantly
				fetchMock
					.mockResolvedValueOnce(jsonResponse(status, {}))
					.mockResolvedValueOnce(jsonResponse(status, {}))
					.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

				const promise = buildClient().client.get('/horario', {});
				await jest.advanceTimersByTimeAsync(10_000);

				await expect(promise).resolves.toEqual({ ok: true });
				expect(fetchMock).toHaveBeenCalledTimes(3);
			},
		);

		it('throws after exhausting the retry budget', async () => {
			jest.useFakeTimers();
			jest.spyOn(Math, 'random').mockReturnValue(0);
			fetchMock.mockResolvedValue(jsonResponse(500, { cabecera: { mensajeRespuesta: 'down' } }));

			const promise = buildClient().client.get('/horario', {});
			const assertion = expect(promise).rejects.toThrow(BannerHttpError);
			await jest.advanceTimersByTimeAsync(10_000);
			await assertion;

			// initial attempt + MAX_TRANSIENT_RETRIES(3) retries = 4 total calls
			expect(fetchMock).toHaveBeenCalledTimes(4);
		});
	});

	describe('jittered backoff', () => {
		it('waits a random amount bounded by the exponential ceiling, not a fixed delay', async () => {
			jest.useFakeTimers();
			const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
			jest.spyOn(Math, 'random').mockReturnValue(0.5);
			fetchMock
				.mockResolvedValueOnce(jsonResponse(500, {}))
				.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

			const promise = buildClient().client.get('/horario', {});
			await jest.advanceTimersByTimeAsync(10_000);
			await promise;

			// attempt 0: ceiling = min(8000, 500 * 2^0) = 500; jitter 0.5 -> 250ms
			expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 250);
		});
	});

	describe('429 with Retry-After', () => {
		it('honors a numeric (seconds) Retry-After header instead of jittered backoff', async () => {
			jest.useFakeTimers();
			const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
			fetchMock
				.mockResolvedValueOnce(jsonResponse(429, {}, { 'retry-after': '2' }))
				.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

			const promise = buildClient().client.get('/horario', {});
			await jest.advanceTimersByTimeAsync(10_000);
			await promise;

			expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
		});

		it('clamps an unreasonably large Retry-After to the backoff ceiling', async () => {
			jest.useFakeTimers();
			const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
			fetchMock
				.mockResolvedValueOnce(jsonResponse(429, {}, { 'retry-after': '3600' }))
				.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

			const promise = buildClient().client.get('/horario', {});
			await jest.advanceTimersByTimeAsync(10_000);
			await promise;

			expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 8000);
		});

		it('falls back to jittered backoff when the header is missing or unparseable', async () => {
			jest.useFakeTimers();
			const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
			jest.spyOn(Math, 'random').mockReturnValue(0);
			fetchMock
				.mockResolvedValueOnce(jsonResponse(429, {}))
				.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

			const promise = buildClient().client.get('/horario', {});
			await jest.advanceTimersByTimeAsync(10_000);
			await promise;

			expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
		});
	});
});
