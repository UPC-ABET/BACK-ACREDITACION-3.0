import { ConfigService } from '@nestjs/config';
import {
	PlannerLoginRejectedError,
	PlannerLoginUnreachableError,
} from '../model/session-expired.error';
import { PlannerLoginClient } from './planner-login.client';

const USERNAME = 'planner-operator';
const PASSWORD = 'example-pw';
const PASSWORD_B64 = 'ZXhhbXBsZS1wdw==';

const ACCESS_EXP = 1786284635;
const REFRESH_EXP = 1786293275;

const jwt = (payload: Record<string, unknown>) =>
	`eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString(
		'base64url',
	)}.signature`;

const ACCESS_TOKEN = jwt({
	email: 'planner-operator@example.edu',
	userId: 804988,
	exp: ACCESS_EXP,
});
const REFRESH_TOKEN = jwt({
	email: 'planner-operator@example.edu',
	userId: 804988,
	exp: REFRESH_EXP,
});
const PRE_AUTH_TOKEN = jwt({ users: { name: 'PLANNER-OPERATOR' }, exp: ACCESS_EXP });

const jsonResponse = (status: number, body: unknown) => ({
	ok: status >= 200 && status < 300,
	status,
	text: async () => JSON.stringify(body),
});

const validateBody = {
	data: {
		user: { username: 'PLANNER-OPERATOR', id: 804988, name: 'Planner Operator' },
		token: ACCESS_TOKEN,
		refreshToken: REFRESH_TOKEN,
		status: true,
	},
	status: true,
};

const buildClient = () =>
	new PlannerLoginClient({ get: () => undefined } as unknown as ConfigService);

const fetchMock = jest.fn();

describe('PlannerLoginClient', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = fetchMock as unknown as typeof fetch;
	});

	describe('the happy path', () => {
		beforeEach(() => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(jsonResponse(200, validateBody));
		});

		it('maps the validate response onto a session', async () => {
			await expect(buildClient().login(USERNAME, PASSWORD)).resolves.toEqual({
				userId: 804988,
				accessToken: ACCESS_TOKEN,
				refreshToken: REFRESH_TOKEN,
				accessTokenExpiresAt: new Date(ACCESS_EXP * 1000).toISOString(),
				refreshTokenExpiresAt: new Date(REFRESH_EXP * 1000).toISOString(),
			});
		});

		it('posts step 1 with the exact payload, password base64-encoded', async () => {
			await buildClient().login(USERNAME, PASSWORD);

			const [url, init] = fetchMock.mock.calls[0];
			expect(url).toBe('https://upc-e2g-post-api.u-planner.com/api/user-api');
			expect(init.method).toBe('POST');
			expect(JSON.parse(init.body)).toEqual({
				name: USERNAME,
				password: PASSWORD_B64,
				error: false,
				type: 'web',
				authName: '',
			});
		});

		// Nothing renews with the refresh token, so its absence must not fail an otherwise good
		// login — the "fails closed on data it does not need" shape this client replaced.
		it('succeeds when u-planner omits the refresh token entirely', async () => {
			fetchMock.mockReset();
			fetchMock
				.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(
					jsonResponse(200, {
						data: { user: { id: 804988 }, token: ACCESS_TOKEN, status: true },
						status: true,
					}),
				);

			await expect(buildClient().login(USERNAME, PASSWORD)).resolves.toMatchObject({
				userId: 804988,
				accessToken: ACCESS_TOKEN,
				refreshToken: undefined,
				refreshTokenExpiresAt: null,
			});
		});

		// Unreachable rather than rejected: u-planner accepted the pair and then returned a token it
		// cannot have meant to send, so blaming the credentials would arm the verification penalty
		// and have an operator retype a correct password against a fault no password can fix.
		//
		// The `exp` values are the two that bypass an is-it-a-number check: absent (reaching the
		// finite guard) and out of Date range, where `toISOString` throws a raw RangeError that is
		// neither login error and so escapes every classifier as a 500.
		it.each([
			['carries no expiry', {}],
			['carries an out-of-range expiry', { exp: 9e15 }],
		])('treats an ACCESS token that %s as unreachable', async (_label, claims) => {
			fetchMock.mockReset();
			fetchMock
				.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(
					jsonResponse(200, {
						data: { user: { id: 804988 }, token: jwt({ userId: 804988, ...claims }) },
						status: true,
					}),
				);

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toBeInstanceOf(
				PlannerLoginUnreachableError,
			);
		});

		it('tolerates a decodable REFRESH token that carries no expiry', async () => {
			fetchMock.mockReset();
			fetchMock
				.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(
					jsonResponse(200, {
						data: {
							user: { id: 804988 },
							token: ACCESS_TOKEN,
							refreshToken: jwt({ userId: 804988 }),
							status: true,
						},
						status: true,
					}),
				);

			await expect(buildClient().login(USERNAME, PASSWORD)).resolves.toMatchObject({
				accessToken: ACCESS_TOKEN,
				refreshTokenExpiresAt: null,
			});
		});

		// Recorded only when it is a string. Passed through verbatim it would reach the store, and
		// from there a consumer that assumes the declared type.
		it('drops a refresh token that is not a string', async () => {
			fetchMock.mockReset();
			fetchMock
				.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(
					jsonResponse(200, {
						data: { user: { id: 804988 }, token: ACCESS_TOKEN, refreshToken: 12345 },
						status: true,
					}),
				);

			await expect(buildClient().login(USERNAME, PASSWORD)).resolves.toMatchObject({
				refreshToken: undefined,
				refreshTokenExpiresAt: null,
			});
		});

		it('succeeds when the refresh token is undecodable', async () => {
			fetchMock.mockReset();
			fetchMock
				.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(
					jsonResponse(200, {
						data: {
							user: { id: 804988 },
							token: ACCESS_TOKEN,
							refreshToken: 'not-a-jwt',
							status: true,
						},
						status: true,
					}),
				);

			await expect(buildClient().login(USERNAME, PASSWORD)).resolves.toMatchObject({
				accessToken: ACCESS_TOKEN,
				refreshToken: 'not-a-jwt',
				refreshTokenExpiresAt: null,
			});
		});

		it('posts step 2 with the pre-auth token in the x-access-token header', async () => {
			await buildClient().login(USERNAME, PASSWORD);

			const [url, init] = fetchMock.mock.calls[1];
			expect(url).toBe('https://upc-e2g-post-api.u-planner.com/api/user-api/validate');
			expect(init.method).toBe('POST');
			expect(init.headers['x-access-token']).toBe(PRE_AUTH_TOKEN);
			expect(init.headers.Authorization).toBeUndefined();
		});
	});

	describe('rejections', () => {
		// The payload is valid, so only the HTTP status can reject it. A fixture with no payload
		// would trip the payload guard instead and pass even with `!response.ok` deleted.
		it('treats a 401 on step 1 as rejected credentials', async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(401, { data: PRE_AUTH_TOKEN, status: true, message: 'Unauthorized' }),
			);

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toThrow(
				/rejected the login \(401\): Unauthorized/,
			);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it("carries u-planner's own message into the error", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(401, { data: PRE_AUTH_TOKEN, status: true, message: 'Cuenta bloqueada' }),
			);

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toThrow(/Cuenta bloqueada/);
		});

		it('appends nothing when the rejection carries no message', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(403, { data: PRE_AUTH_TOKEN, status: true }));

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toThrow(
				/rejected the login \(403\)$/,
			);
		});

		// The captured sample was a success, so this shape was never observed. A `status: false`
		// body on a 200 is the most likely way u-planner reports a bad password.
		//
		// The payload is deliberately VALID so only the `status` flag can reject it — a fixture
		// with `data: null` trips the payload guard first and would pass with the flag check gone.
		it('treats a 200 carrying status:false as rejected credentials', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: false }));

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toThrow(/rejected the login/);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it('treats status:false on step 2 as rejected credentials', async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(jsonResponse(200, { ...validateBody, status: false }));

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toThrow(/rejected the login/);
		});

		it('rejects when step 1 returns no usable token', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: '', status: true }));

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toBeInstanceOf(
				PlannerLoginRejectedError,
			);
		});

		it('rejects a 200 whose payload is missing entirely', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: null, status: true }));

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toBeInstanceOf(
				PlannerLoginRejectedError,
			);
		});

		it('rejects when step 2 omits the access token', async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(
					jsonResponse(200, { data: { user: { id: 804988 }, refreshToken: REFRESH_TOKEN } }),
				);

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toBeInstanceOf(
				PlannerLoginRejectedError,
			);
		});

		it('rejects when step 2 omits the user id', async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(
					jsonResponse(200, {
						data: { user: {}, token: ACCESS_TOKEN, refreshToken: REFRESH_TOKEN },
					}),
				);

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toBeInstanceOf(
				PlannerLoginRejectedError,
			);
		});

		it('rejects a non-JSON body', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				status: 200,
				text: async () => '<html>502</html>',
			});

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toBeInstanceOf(
				PlannerLoginRejectedError,
			);
		});
	});

	describe('unreachable', () => {
		it('treats a 500 as unreachable, not as rejected credentials', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'Internal Server Error' }));

			const error = await buildClient()
				.login(USERNAME, PASSWORD)
				.catch((e: unknown) => e);

			expect(error).toBeInstanceOf(PlannerLoginUnreachableError);
			expect(error).not.toBeInstanceOf(PlannerLoginRejectedError);
		});

		it('treats a network failure as unreachable', async () => {
			fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toBeInstanceOf(
				PlannerLoginUnreachableError,
			);
		});

		// undici reports DNS, TLS, a refused connection and a blocked redirect identically as
		// `TypeError: fetch failed`, with the only discriminating text in `cause`.
		it('carries the nested cause into the message', async () => {
			fetchMock.mockRejectedValueOnce(
				new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND') }),
			);

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toThrow(
				/TypeError: fetch failed <- Error: getaddrinfo ENOTFOUND/,
			);
		});

		/**
		 * Only asserts a signal is attached. `AbortSignal.timeout` schedules on Node's platform
		 * timer, which jest's fake timers do not intercept, and the real bound is 15s — so a signal
		 * that never fires is not distinguishable here. Closing that gap would mean making the
		 * timeout configurable, which would break the cooldowns derived from it. The paired
		 * assertion is `surfaces an aborted request as unreachable`, which pins what happens when
		 * it does fire.
		 */
		it('attaches an abort signal to the request', async () => {
			await buildClient()
				.login(USERNAME, PASSWORD)
				.catch(() => undefined);

			const [, init] = fetchMock.mock.calls[0];
			expect(init.signal).toBeInstanceOf(AbortSignal);
			expect(init.signal.aborted).toBe(false);
		});

		// The abort signal covers the body stream, so a stall after the headers arrive fails during
		// response.text(). That must not read as a wrong password — it arms the credential throttle
		// and tells the operator a correct pair was refused.
		it('treats a truncated response body as unreachable', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				status: 200,
				text: async () => {
					throw new Error('terminated');
				},
			});

			const error = await buildClient()
				.login(USERNAME, PASSWORD)
				.catch((e: unknown) => e);

			expect(error).toBeInstanceOf(PlannerLoginUnreachableError);
			expect(error).not.toBeInstanceOf(PlannerLoginRejectedError);
		});

		// 404/405/410 are the shape of a drifted PLANNER_LOGIN_API_URL — a deployment fault, not a
		// wrong password. Reporting them as rejected sends an operator to retype a correct one.
		it.each([404, 405, 408, 410, 429])(
			'treats %i as unreachable rather than a credential verdict',
			async (status) => {
				fetchMock.mockResolvedValueOnce(jsonResponse(status, { message: 'slow down' }));

				const error = await buildClient()
					.login(USERNAME, PASSWORD)
					.catch((e: unknown) => e);

				expect(error).toBeInstanceOf(PlannerLoginUnreachableError);
				expect(error).not.toBeInstanceOf(PlannerLoginRejectedError);
			},
		);

		it('rejects a JSON null body rather than throwing a raw TypeError', async () => {
			fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'null' });

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toBeInstanceOf(
				PlannerLoginRejectedError,
			);
		});

		// `Number()` coerces null, '' and [] to a finite 0 — a session that authenticates and then
		// returns nothing for every `user=0` request while reporting itself active.
		it.each([null, '', [], 0, '7', 1.5, NaN])(
			'rejects a session whose user id is %p rather than coercing it',
			async (id) => {
				fetchMock
					.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
					.mockResolvedValueOnce(
						jsonResponse(200, {
							data: { user: { id }, token: ACCESS_TOKEN, status: true },
							status: true,
						}),
					);

				await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toBeInstanceOf(
					PlannerLoginRejectedError,
				);
			},
		);

		it('surfaces an aborted request as unreachable, not as rejected credentials', async () => {
			const aborted = new Error('The operation was aborted due to timeout');
			aborted.name = 'TimeoutError';
			fetchMock.mockRejectedValueOnce(aborted);

			const error = await buildClient()
				.login(USERNAME, PASSWORD)
				.catch((e: unknown) => e);

			expect(error).toBeInstanceOf(PlannerLoginUnreachableError);
			expect(error).not.toBeInstanceOf(PlannerLoginRejectedError);
		});
	});

	describe('credential transport safety', () => {
		// On a 307/308 the body (holding the encoded password) and the custom x-access-token header
		// are both preserved across origins, so following one would forward the credential off-host.
		it('refuses to follow redirects on either call', async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(jsonResponse(200, validateBody));

			await buildClient().login(USERNAME, PASSWORD);

			expect(fetchMock.mock.calls[0][1].redirect).toBe('error');
			expect(fetchMock.mock.calls[1][1].redirect).toBe('error');
		});
	});

	describe('secret handling', () => {
		it('never puts the password or its base64 form in an error message', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }));

			const error = (await buildClient()
				.login(USERNAME, PASSWORD)
				.catch((e: unknown) => e)) as Error;

			expect(error.message).not.toContain(PASSWORD);
			expect(error.message).not.toContain(PASSWORD_B64);
		});

		it('honours configured endpoint overrides', async () => {
			const client = new PlannerLoginClient({
				get: (key: string) =>
					key === 'PLANNER_LOGIN_API_URL'
						? 'https://staging.example.com/api/user-api'
						: key === 'PLANNER_VALIDATE_URL'
							? 'https://staging.example.com/api/user-api/validate'
							: undefined,
			} as unknown as ConfigService);

			fetchMock
				.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(jsonResponse(200, validateBody));

			await client.login(USERNAME, PASSWORD);

			expect(fetchMock.mock.calls[0][0]).toBe('https://staging.example.com/api/user-api');
			expect(fetchMock.mock.calls[1][0]).toBe('https://staging.example.com/api/user-api/validate');
		});
	});
});
