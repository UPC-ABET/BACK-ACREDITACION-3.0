import { ConfigService } from '@nestjs/config';
import { PlannerTokenService } from '../../planner-token/api/planner-token.service';
import { PlannerHttpClient } from './planner-http.client';

const SESSION = { userId: 804988, accessToken: 'access-token' }; // abet-allow-secret: fixture

const okResponse = (body: unknown) => ({
	ok: true,
	status: 200,
	text: async () => JSON.stringify(body),
});

const base64Response = (body: unknown) =>
	okResponse(Buffer.from(JSON.stringify(body), 'utf-8').toString('base64'));

const fetchMock = jest.fn();

const buildClient = () => {
	const tokenService = { getValidSession: jest.fn().mockResolvedValue(SESSION) };
	const client = new PlannerHttpClient(
		{ get: () => undefined } as unknown as ConfigService,
		tokenService as unknown as PlannerTokenService,
	);
	return { client, tokenService };
};

describe('PlannerHttpClient', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		fetchMock.mockReset();
		global.fetch = fetchMock as unknown as typeof fetch;
	});

	describe('the response envelope', () => {
		it('returns the array under data', async () => {
			fetchMock.mockResolvedValueOnce(okResponse({ data: [{ id: 1 }, { id: 2 }] }));

			await expect(buildClient().client.get('/secciones', {})).resolves.toEqual([
				{ id: 1 },
				{ id: 2 },
			]);
		});

		it('wraps a single object under data in an array', async () => {
			fetchMock.mockResolvedValueOnce(okResponse({ data: { id: 1 } }));

			await expect(buildClient().client.get('/secciones', {})).resolves.toEqual([{ id: 1 }]);
		});

		/**
		 * The login endpoint on this same host returns its payload base64-encoded inside a JSON
		 * string. This method reports anything it cannot read as an empty result rather than an
		 * error, so if the data API ever answers with that envelope the failure would be a scrape
		 * that completes successfully having stored nothing — the reason the unwrap is applied here
		 * too rather than only where the shape was observed.
		 */
		it('reads records out of a base64-wrapped envelope instead of returning none', async () => {
			fetchMock.mockResolvedValueOnce(base64Response({ data: [{ id: 1 }] }));

			await expect(buildClient().client.get('/secciones', {})).resolves.toEqual([{ id: 1 }]);
		});

		it.each([
			['the body is not JSON', 'not json at all'],
			['data is missing', JSON.stringify({ status: true })],
			['data is null', JSON.stringify({ data: null })],
		])('returns no records when %s', async (_label, text) => {
			fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => text });

			await expect(buildClient().client.get('/secciones', {})).resolves.toEqual([]);
		});
	});

	it('appends the session user id to every request', async () => {
		fetchMock.mockResolvedValueOnce(okResponse({ data: [] }));

		await buildClient().client.get('/secciones', { periodo: '202501' });

		const [url] = fetchMock.mock.calls[0];
		expect(url).toContain('periodo=202501');
		expect(url).toContain(`user=${SESSION.userId}`);
	});
});
