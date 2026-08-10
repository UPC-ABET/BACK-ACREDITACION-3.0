import { ConfigService } from '@nestjs/config';
import {
	PlannerLoginRejectedError,
	PlannerLoginUnreachableError,
} from '../model/planner-session.errors';
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

// The shape u-planner's LDAP path returns, captured live on 2026-08-09.
const base64Response = (status: number, body: unknown) =>
	jsonResponse(status, Buffer.from(JSON.stringify(body), 'utf-8').toString('base64'));

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
		// Preventive: `clearAllMocks` drops recorded calls but not queued `mockResolvedValueOnce`
		// values, so a test that ever leaves one unconsumed would hand it to the next test as its
		// first response — which is how a single failure here cascades into unrelated ones. The
		// per-test `mockReset()` calls below are separate; they clear what a describe-level
		// `beforeEach` queued, and are not made redundant by this.
		fetchMock.mockReset();
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
			['carries no expiry', jwt({ userId: 804988 })],
			['carries an out-of-range expiry', jwt({ userId: 804988, exp: 9e15 })],
			['carries a negative expiry', jwt({ userId: 804988, exp: -1 })],
			['cannot be decoded at all', 'not-a-jwt'],
		])('treats an ACCESS token that %s as unreachable', async (_label, token) => {
			fetchMock.mockReset();
			fetchMock
				.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(
					jsonResponse(200, { data: { user: { id: 804988 }, token }, status: true }),
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

		// The provider's message is the one piece of outside text that reaches our logs. A newline
		// in it would forge what looks like a second log line of our own.
		it('collapses control characters in the provider message', async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse(401, {
					message: 'Cuenta bloqueada\n2026-08-09 WARN [PlannerCredentialsService] Session active',
				}),
			);

			const error = (await buildClient()
				.login(USERNAME, PASSWORD)
				.catch((e: unknown) => e)) as Error;

			expect(error.message).not.toMatch(/[\n\r]/);
			expect(error.message).toContain('Cuenta bloqueada');
		});

		it('truncates a provider message that would flood the log', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'x'.repeat(5_000) }));

			const error = (await buildClient()
				.login(USERNAME, PASSWORD)
				.catch((e: unknown) => e)) as Error;

			expect(error.message.length).toBeLessThan(300);
		});

		it('appends nothing when the rejection carries no message', async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(403, { data: PRE_AUTH_TOKEN, status: true }));

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toThrow(
				/rejected the login \(403\)$/,
			);
		});

		// Confirmed live on 2026-08-09: `status: false` on a 200 is how u-planner reports a bad
		// password. It arrives base64-wrapped in practice — see 'the base64-wrapped envelope' — but
		// the unwrapped shape is what the input-validation path returns and is pinned here.
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
	});

	// Why this envelope exists and what it looks like: see `unwrapBase64Body`. Treating the wrapped
	// shape as unparseable made a wrong password report `503 unreachable`, so the operator was told
	// u-planner was down and the credential penalty never armed.
	describe('the base64-wrapped envelope', () => {
		// `data` is the pre-auth token the live payload does NOT carry, so that only `status: false`
		// can reject this fixture. With it absent, the step-1 no-token guard rejects first and the
		// test would stay green with the whole `status` branch deleted.
		const wrappedRejection = {
			data: PRE_AUTH_TOKEN,
			status: false,
			message: 'Usuario o clave incorrectos!',
			error:
				'80090308: LdapErr: DSID-0C090451, comment: AcceptSecurityContext error, data 52e, v3839',
			username: 'planner-operator@example.edu',
		};

		it('reports a wrapped rejection as rejected credentials, not as an unreachable host', async () => {
			fetchMock.mockResolvedValueOnce(base64Response(200, wrappedRejection));

			const error = await buildClient()
				.login(USERNAME, PASSWORD)
				.catch((e: unknown) => e);

			expect(error).toBeInstanceOf(PlannerLoginRejectedError);
			expect(error).not.toBeInstanceOf(PlannerLoginUnreachableError);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it("carries the wrapped payload's own message into the error", async () => {
			fetchMock.mockResolvedValueOnce(base64Response(200, wrappedRejection));

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toThrow(
				/Usuario o clave incorrectos!/,
			);
		});

		/**
		 * The live payload proves u-planner returns directory internals alongside the message: the
		 * raw `LdapErr` code and the resolved account name. `providerMessage` reads `message` only,
		 * and this is what objects if that is ever widened to another field.
		 */
		it('leaves the directory internals out of the error message', async () => {
			fetchMock.mockResolvedValueOnce(base64Response(200, wrappedRejection));

			const error = (await buildClient()
				.login(USERNAME, PASSWORD)
				.catch((e: unknown) => e)) as Error;

			expect(error.message).not.toContain('LdapErr');
			expect(error.message).not.toContain(wrappedRejection.username);
		});

		it('reports a wrapped status:false on step 2 as rejected credentials', async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(base64Response(200, { ...validateBody, status: false }));

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toBeInstanceOf(
				PlannerLoginRejectedError,
			);
		});

		// Whether a *successful* login is wrapped could not be observed without a working operator
		// account, so both shapes have to work on both steps rather than one being assumed.
		it('logs in when both steps arrive wrapped', async () => {
			fetchMock
				.mockResolvedValueOnce(base64Response(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(base64Response(200, validateBody));

			await expect(buildClient().login(USERNAME, PASSWORD)).resolves.toMatchObject({
				userId: 804988,
				accessToken: ACCESS_TOKEN,
			});
		});

		it('logs in when only step 1 arrives wrapped', async () => {
			fetchMock
				.mockResolvedValueOnce(base64Response(200, { data: PRE_AUTH_TOKEN, status: true }))
				.mockResolvedValueOnce(jsonResponse(200, validateBody));

			await expect(buildClient().login(USERNAME, PASSWORD)).resolves.toMatchObject({
				accessToken: ACCESS_TOKEN,
			});
		});

		it('reports a wrapped 401 as rejected credentials', async () => {
			fetchMock.mockResolvedValueOnce(
				base64Response(401, { data: PRE_AUTH_TOKEN, status: true, message: 'Cuenta bloqueada' }),
			);

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toThrow(
				/rejected the login \(401\): Cuenta bloqueada/,
			);
		});

		// The unwrap must not become a second way to accept a payload the guards would refuse: a
		// wrapped body still has to satisfy every check an unwrapped one does.
		it('still rejects a wrapped step 1 that carries no token', async () => {
			fetchMock.mockResolvedValueOnce(base64Response(200, { data: '', status: true }));

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toBeInstanceOf(
				PlannerLoginRejectedError,
			);
		});

		// The boundary of the unwrap: anything that does not come back a JSON object is still an
		// unreachable host, never a credential verdict. Double-wrapping is included because the
		// unwrap is single-level by design (see `unwrapBase64Body`), so it lands here rather than
		// silently costing a second decode.
		it.each([
			['is a plain JSON string', '"service temporarily unavailable"'],
			['is an empty JSON string', '""'],
			[
				'base64-decodes to something that is not JSON',
				`"${Buffer.from('nope').toString('base64')}"`,
			],
			['base64-decodes to a JSON scalar', `"${Buffer.from('42').toString('base64')}"`],
			[
				'is wrapped twice',
				JSON.stringify(
					Buffer.from(Buffer.from(JSON.stringify({ status: true })).toString('base64')).toString(
						'base64',
					),
				),
			],
		])('treats a 200 whose body %s as an unreachable host', async (_label, text) => {
			fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => text });

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toBeInstanceOf(
				PlannerLoginUnreachableError,
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

		// The abort signal bounds how long a body may take to arrive, not how large it may be, and
		// the unwrap decodes and re-parses whatever does arrive.
		it('treats an oversized body as unreachable', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				status: 200,
				text: async () => JSON.stringify({ data: 'x'.repeat(400_000), status: true }),
			});

			const error = await buildClient()
				.login(USERNAME, PASSWORD)
				.catch((e: unknown) => e);

			expect(error).toBeInstanceOf(PlannerLoginUnreachableError);
			expect((error as Error).message).toMatch(/oversized body/);
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

		/**
		 * A 2xx that is not a JSON object is a WAF, a captive proxy or a maintenance page answering
		 * for u-planner — it says nothing about the credentials. Calling it a rejection returns 400
		 * and arms the 30s penalty, so every operator is rate-limited while retyping a password that
		 * was never wrong. `'null'` additionally parses, so without the object guard it would reach
		 * the property reads as a raw TypeError.
		 */
		it.each([
			['is not JSON at all', '<html>502 Bad Gateway</html>'],
			['parses to JSON null', 'null'],
			['parses to a JSON array', '[]'],
		])('treats a 200 whose body %s as unreachable', async (_label, text) => {
			fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => text });

			await expect(buildClient().login(USERNAME, PASSWORD)).rejects.toBeInstanceOf(
				PlannerLoginUnreachableError,
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
