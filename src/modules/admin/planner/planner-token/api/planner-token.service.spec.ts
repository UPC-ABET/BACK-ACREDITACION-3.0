import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ScraperCredentialService } from 'src/modules/admin/scraping/credentials/api/scraper-credentials.service';
import {
	PlannerLoginRejectedError,
	PlannerLoginUnreachableError,
	PlannerSessionExpiredError,
} from '../model/session-expired.error';
import { plannerSessionValidationStrings } from '../config/strings/planner-session.validation';
import { PlannerLoginClient } from '../core/planner-login.client';
import { PlannerSessionStore } from '../core/planner-session.store';
import { PlannerTokenSession } from '../model/planner-session.types';
import { PlannerTokenService } from './planner-token.service';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();

const session = (accessInMs: number, refreshInMs: number): PlannerTokenSession => ({
	userId: 804988,
	accessToken: 'example-access-token',
	refreshToken: 'example-refresh-token',
	accessTokenExpiresAt: inMs(accessInMs),
	refreshTokenExpiresAt: inMs(refreshInMs),
});

const freshSession = () => session(12 * HOUR, 14 * HOUR);

const PLAINTEXT = 'example-pw';
const CREDENTIAL = { username: 'planner-operator', password: PLAINTEXT };

const mockStore = { read: jest.fn(), save: jest.fn() };
const mockLoginClient = { login: jest.fn() };
const mockCredentials = { getDecrypted: jest.fn(), isConfigured: jest.fn() };

const buildService = () =>
	new PlannerTokenService(
		mockStore as unknown as PlannerSessionStore,
		mockLoginClient as unknown as PlannerLoginClient,
		mockCredentials as unknown as ScraperCredentialService,
	);

describe('PlannerTokenService', () => {
	// Every implementation is re-stubbed: `clearAllMocks` resets calls but NOT implementations, so
	// a `mockImplementation` from one case otherwise rebinds `store.read` in every later one.
	beforeEach(() => {
		jest.clearAllMocks();
		mockStore.read.mockReturnValue(null);
		mockStore.save.mockImplementation(() => undefined);
		mockCredentials.isConfigured.mockResolvedValue(true);
		mockCredentials.getDecrypted.mockResolvedValue(CREDENTIAL);
		mockLoginClient.login.mockResolvedValue(freshSession());
	});

	describe('getValidSession', () => {
		it('returns the stored session without logging in when the access token is still valid', async () => {
			const stored = freshSession();
			mockStore.read.mockReturnValue(stored);

			await expect(buildService().getValidSession()).resolves.toEqual(stored);
			expect(mockLoginClient.login).not.toHaveBeenCalled();
		});

		it('logs in again when forced, even with a valid stored session', async () => {
			mockStore.read.mockReturnValue(freshSession());

			await buildService().getValidSession(true);

			expect(mockLoginClient.login).toHaveBeenCalledTimes(1);
		});

		it('logs in when there is no stored session at all', async () => {
			mockStore.read.mockReturnValue(null);

			await buildService().getValidSession();

			expect(mockLoginClient.login).toHaveBeenCalledWith(CREDENTIAL.username, PLAINTEXT);
			expect(mockStore.save).toHaveBeenCalledWith(
				await mockLoginClient.login.mock.results[0].value,
			);
		});

		// The production wedge: the old code preferred a refresh-token call whenever the refresh
		// token was still in date, and that call could never succeed. There must be no such branch.
		it('performs a full login when the access token is dead but the refresh token is still valid', async () => {
			mockStore.read.mockReturnValue(session(-1 * MINUTE, 2 * HOUR));

			await buildService().getValidSession();

			expect(mockLoginClient.login).toHaveBeenCalledTimes(1);
		});

		it('logs in when the access token is inside the refresh skew', async () => {
			mockStore.read.mockReturnValue(session(30_000, 2 * HOUR));

			await buildService().getValidSession();

			expect(mockLoginClient.login).toHaveBeenCalledTimes(1);
		});

		it('shares one login between concurrent callers', async () => {
			mockStore.read.mockReturnValue(null);
			const service = buildService();

			await Promise.all([service.getValidSession(), service.getValidSession()]);

			expect(mockLoginClient.login).toHaveBeenCalledTimes(1);
		});

		// A forced caller joining a non-forced flight would be handed the cached session it is
		// trying to replace — which is the scraper's 401 retry silently re-sending a dead token.
		it('does not let a forced caller share a non-forced flight', async () => {
			const stored = freshSession();
			mockStore.read.mockReturnValue(stored);
			let releaseLogin: (session: PlannerTokenSession) => void = () => undefined;
			mockCredentials.getDecrypted.mockReturnValue(
				new Promise((resolve) => {
					releaseLogin = () => resolve(CREDENTIAL);
				}),
			);
			const service = buildService();

			// Non-forced flight, held open inside credential resolution.
			mockStore.read.mockReturnValueOnce(null);
			const slow = service.getValidSession();
			const forced = service.getValidSession(true);
			releaseLogin(stored);
			await Promise.all([slow, forced]);

			expect(mockLoginClient.login).toHaveBeenCalledTimes(2);
		});

		// If the flight it queued behind already replaced the session, the forced caller has nothing
		// left to force. Re-logging in would double the wall clock and hand its own failure to every
		// non-forced caller that joined in the meantime.
		it('does not log in again when the predecessor already replaced the session', async () => {
			const replacement = { ...freshSession(), accessToken: 'example-replacement-token' };
			mockStore.read.mockReturnValue(null);
			let releaseLogin: () => void = () => undefined;
			mockCredentials.getDecrypted.mockReturnValue(
				new Promise((resolve) => {
					releaseLogin = () => resolve(CREDENTIAL);
				}),
			);
			mockLoginClient.login.mockResolvedValue(replacement);
			const service = buildService();

			const slow = service.getValidSession();
			const forced = service.getValidSession(true);
			mockStore.read.mockReturnValue(replacement);
			releaseLogin();

			await expect(forced).resolves.toEqual(replacement);
			await slow;
			expect(mockLoginClient.login).toHaveBeenCalledTimes(1);
		});

		// The other half of the same rule: a predecessor that leaves a nearly-dead token has not
		// satisfied the forced caller, which asked precisely because its token was being refused.
		it('still logs in when the predecessor left a session inside the skew', async () => {
			const nearlyDead = { ...session(30_000, 2 * HOUR), accessToken: 'example-nearly-dead-token' };
			mockStore.read.mockReturnValue(null);
			let releaseLogin: () => void = () => undefined;
			mockCredentials.getDecrypted.mockReturnValue(
				new Promise((resolve) => {
					releaseLogin = () => resolve(CREDENTIAL);
				}),
			);
			mockLoginClient.login.mockResolvedValue(nearlyDead);
			const service = buildService();

			const slow = service.getValidSession();
			const forced = service.getValidSession(true);
			mockStore.read.mockReturnValue(nearlyDead);
			releaseLogin();
			await Promise.all([slow, forced]);

			expect(mockLoginClient.login).toHaveBeenCalledTimes(2);
		});

		// A settling predecessor must not clear the slot a chained flight now owns, or the next
		// caller starts a third login instead of joining the one already running.
		it('does not let a settled predecessor clear the chained flight', async () => {
			const replacement = { ...freshSession(), accessToken: 'example-replacement-token' };
			let releaseFirst: () => void = () => undefined;
			let releaseSecond: () => void = () => undefined;
			mockLoginClient.login
				.mockReturnValueOnce(
					new Promise((resolve) => {
						releaseFirst = () => resolve(freshSession());
					}),
				)
				.mockReturnValueOnce(
					new Promise((resolve) => {
						releaseSecond = () => resolve(replacement);
					}),
				);
			const service = buildService();

			const slow = service.getValidSession();
			const forced = service.getValidSession(true);
			releaseFirst();
			await Promise.resolve();
			await Promise.resolve();

			const joiner = service.getValidSession();
			releaseSecond();
			await Promise.all([slow, forced, joiner]);

			expect(mockLoginClient.login).toHaveBeenCalledTimes(2);
		});

		it('lets concurrent forced callers share one login', async () => {
			mockStore.read.mockReturnValue(freshSession());
			const service = buildService();

			await Promise.all([service.getValidSession(true), service.getValidSession(true)]);

			expect(mockLoginClient.login).toHaveBeenCalledTimes(1);
		});
	});

	describe('getStatus', () => {
		it('reports not_configured when no credentials have been stored', async () => {
			mockCredentials.isConfigured.mockResolvedValue(false);
			mockStore.read.mockReturnValue(null);

			await expect(buildService().getStatus()).resolves.toEqual({
				status: 'not_configured',
				tokenExp: null,
			});
		});

		// An orphaned store file from a previous configuration must not make an unconfigured
		// system look active — the credentials check has to come first.
		it('reports not_configured even when a stale session file is still on disk', async () => {
			mockCredentials.isConfigured.mockResolvedValue(false);
			mockStore.read.mockReturnValue(freshSession());

			await expect(buildService().getStatus()).resolves.toEqual({
				status: 'not_configured',
				tokenExp: null,
			});
		});

		it('reports active for a healthy session', async () => {
			const stored = freshSession();
			mockStore.read.mockReturnValue(stored);

			await expect(buildService().getStatus()).resolves.toEqual({
				status: 'active',
				tokenExp: stored.accessTokenExpiresAt,
			});
		});

		it('reports expiring inside the 30 minute window', async () => {
			const stored = session(10 * MINUTE, 2 * HOUR);
			mockStore.read.mockReturnValue(stored);

			await expect(buildService().getStatus()).resolves.toEqual({
				status: 'expiring',
				tokenExp: stored.accessTokenExpiresAt,
			});
		});

		it('reports expired once the access token has lapsed', async () => {
			mockStore.read.mockReturnValue(session(-1 * MINUTE, 2 * HOUR));

			await expect(buildService().getStatus()).resolves.toMatchObject({ status: 'expired' });
		});

		it('reports expired when configured but no session file exists', async () => {
			mockStore.read.mockReturnValue(null);

			await expect(buildService().getStatus()).resolves.toEqual({
				status: 'expired',
				tokenExp: null,
			});
		});
	});

	describe('refresh without credentials', () => {
		it('fails with a distinct key instead of attempting a login', async () => {
			mockCredentials.isConfigured.mockResolvedValue(false);
			mockStore.read.mockReturnValue(null);

			await expect(buildService().refresh()).rejects.toMatchObject({
				messageKey: plannerSessionValidationStrings.error.credentialsNotConfigured,
			});
			expect(mockLoginClient.login).not.toHaveBeenCalled();
		});
	});

	describe('failure paths are never silent', () => {
		let logged: unknown[];
		let debug: jest.SpyInstance;

		// Every level, not just warn/debug: a leak through log/error/verbose would otherwise be
		// invisible to the assertions below *and* printed to the console.
		beforeEach(() => {
			logged = [];
			const collect = (...args: unknown[]) => void logged.push(...args);
			for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
				jest.spyOn(Logger.prototype, level).mockImplementation(collect);
			}
			debug = jest.spyOn(Logger.prototype, 'debug');
		});

		// Runs after EVERY case in this block, so each failure path proves the absence itself. A
		// single dedicated test cannot: the log statements live on the failure paths, so a test
		// driving a success asserts against no output at all.
		afterEach(() => {
			const output = logged.join(' ');
			expect(output).not.toContain(CREDENTIAL.password);
			expect(output).not.toContain(CREDENTIAL.username);
			expect(output).not.toContain(freshSession().accessToken);
			expect(output).not.toContain(freshSession().refreshToken);
		});

		afterEach(() => jest.restoreAllMocks());

		it('logs why a refresh ended up expired', async () => {
			mockStore.read.mockReturnValue(null);
			mockLoginClient.login.mockRejectedValue(
				new PlannerLoginRejectedError('Planner rejected the login (401)'),
			);

			await expect(buildService().refresh()).resolves.toEqual({
				status: 'expired',
				tokenExp: null,
			});

			expect(logged.join(' ')).toContain('Planner rejected the login (401)');
		});

		// The scraper reaches sessions through getValidSession(), never refresh(), so a login
		// failure mid-scrape must log from the login path itself or it is silent.
		it('logs a login failure that never goes through refresh()', async () => {
			mockStore.read.mockReturnValue(null);
			mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('rejected at 401'));

			await expect(buildService().getValidSession()).rejects.toBeInstanceOf(
				PlannerLoginRejectedError,
			);

			expect(logged.join(' ')).toContain('rejected at 401');
		});

		it('logs when credentials vanish between the check and the login', async () => {
			mockStore.read.mockReturnValue(null);
			mockCredentials.getDecrypted.mockResolvedValue(null);

			await expect(buildService().getValidSession()).rejects.toBeInstanceOf(
				PlannerSessionExpiredError,
			);

			expect(logged.join(' ')).toContain('not configured');
			expect(mockLoginClient.login).not.toHaveBeenCalled();
		});

		it('logs when the cooldown short-circuits a refresh', async () => {
			mockStore.read.mockReturnValue(null);
			mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('nope'));
			const service = buildService();

			await service.refresh();
			await service.refresh();

			expect(debug).toHaveBeenCalledTimes(1);
			expect(mockLoginClient.login).toHaveBeenCalledTimes(1);
		});

		// Drives both statements that exist — the warn in login()'s catch and the debug in the
		// cooldown branch — with a real session on disk, so the shared afterEach has actual output
		// to inspect rather than an empty array.
		it('emits both failure log lines without leaking a secret', async () => {
			mockStore.read.mockReturnValue(freshSession());
			mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('401'));
			const service = buildService();

			await service.refresh();
			await service.refresh();

			expect(logged.length).toBeGreaterThan(0);
			expect(debug).toHaveBeenCalledTimes(1);
		});

		it('rethrows anything that is not a session failure', async () => {
			mockStore.read.mockReturnValue(null);
			mockLoginClient.login.mockRejectedValue(new TypeError('programmer error'));

			await expect(buildService().refresh()).rejects.toThrow(TypeError);
		});
	});

	describe('cooldown and recovery', () => {
		beforeEach(() => {
			jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
			jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		});

		afterEach(() => jest.restoreAllMocks());

		// A refused login disproves the stored session however much life its `exp` claims. Reporting
		// `active` here is how an operator ends up staring at a green screen while nothing works.
		it('reports expired when the forced login is refused, even with a healthy session on disk', async () => {
			const stored = freshSession();
			mockStore.read.mockReturnValue(stored);
			mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('401'));

			await expect(buildService().refresh()).resolves.toEqual({
				status: 'expired',
				tokenExp: stored.accessTokenExpiresAt,
			});
		});

		// An unreachable host disproves nothing about the stored session — the scraper keeps using
		// it successfully — so reporting `expired` would send the operator to re-enter a correct
		// password. The credential-save path already answers 503 for the same failure.
		it('surfaces an unreachable u-planner as 503, not as expired', async () => {
			mockStore.read.mockReturnValue(freshSession());
			mockLoginClient.login.mockRejectedValue(new PlannerLoginUnreachableError('ECONNREFUSED'));

			await expect(buildService().refresh()).rejects.toBeInstanceOf(ServiceUnavailableException);
		});

		it('replays the 503 while the cooldown suppresses the retry', async () => {
			mockStore.read.mockReturnValue(freshSession());
			mockLoginClient.login.mockRejectedValue(new PlannerLoginUnreachableError('ECONNREFUSED'));
			const service = buildService();

			await expect(service.refresh()).rejects.toBeInstanceOf(ServiceUnavailableException);
			await expect(service.refresh()).rejects.toBeInstanceOf(ServiceUnavailableException);
			expect(mockLoginClient.login).toHaveBeenCalledTimes(1);
		});

		it('keeps reporting expired while the cooldown suppresses the retry', async () => {
			const stored = freshSession();
			mockStore.read.mockReturnValue(stored);
			mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('401'));
			const service = buildService();

			await service.refresh();

			await expect(service.refresh()).resolves.toEqual({
				status: 'expired',
				tokenExp: stored.accessTokenExpiresAt,
			});
			expect(mockLoginClient.login).toHaveBeenCalledTimes(1);
		});

		it('releases the cooldown once it has elapsed', async () => {
			jest.useFakeTimers({ doNotFake: ['performance'] });
			try {
				mockStore.read.mockReturnValue(null);
				mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('nope'));
				const service = buildService();

				await service.refresh();
				jest.advanceTimersByTime(31_000);
				await service.refresh();

				expect(mockLoginClient.login).toHaveBeenCalledTimes(2);
			} finally {
				jest.useRealTimers();
			}
		});

		it('clears the cooldown when a session is adopted from the credential save path', async () => {
			mockStore.read.mockReturnValue(null);
			mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('nope'));
			const service = buildService();
			await service.refresh();

			service.adoptSession(freshSession());
			mockStore.read.mockReturnValue(freshSession());
			mockLoginClient.login.mockResolvedValue(freshSession());

			await expect(service.refresh()).resolves.toMatchObject({ status: 'active' });
			expect(mockLoginClient.login).toHaveBeenCalledTimes(2);
		});

		// A login started under the previous credentials must not overwrite the session a credential
		// change has since adopted — otherwise the DB holds account B while the store serves A.
		// The caller gets the adopted session instead: handing back a token for the account that was
		// just rotated away would let a whole scrape run under the retired identity.
		it('discards a login superseded by a credential change and returns the adopted session', async () => {
			const newAccountSession = { ...freshSession(), accessToken: 'example-new-account-token' };
			const oldCredentialSession = { ...freshSession(), accessToken: 'example-old-account-token' };
			const service = buildService();

			// The rotation lands *while the login is in flight* — after its credentials were read,
			// which is the only interleaving that makes the result genuinely stale.
			mockLoginClient.login.mockImplementation(() => {
				mockStore.save.mockImplementation(() => mockStore.read.mockReturnValue(newAccountSession));
				service.adoptSession(newAccountSession);
				mockStore.save.mockClear();
				return Promise.resolve(oldCredentialSession);
			});

			await expect(service.getValidSession()).resolves.toEqual(newAccountSession);
			expect(mockStore.save).not.toHaveBeenCalled();
		});

		// The mirror case: a rotation that lands before the credentials are read is simply used,
		// and must not be mistaken for a supersession that discards a valid result.
		it('keeps a login whose credentials were read after the change', async () => {
			const session = { ...freshSession(), accessToken: 'example-post-change-token' };
			const service = buildService();
			service.adoptSession({ ...freshSession(), accessToken: 'example-new-account-token' });
			mockLoginClient.login.mockResolvedValue(session);
			mockStore.save.mockClear();

			await expect(service.getValidSession(true)).resolves.toEqual(session);
			expect(mockStore.save).toHaveBeenCalledWith(session);
		});

		it('reports active after a successful refresh', async () => {
			const stored = freshSession();
			mockStore.read.mockReturnValue(null);
			mockLoginClient.login.mockResolvedValue(stored);
			mockStore.save.mockImplementation(() => mockStore.read.mockReturnValue(stored));

			await expect(buildService().refresh()).resolves.toEqual({
				status: 'active',
				tokenExp: stored.accessTokenExpiresAt,
			});
		});

		// The operator's Refresh button must reach u-planner even when the stored token has not
		// expired — "unexpired but rejected server-side" is the original production failure.
		it('forces a login even when the stored access token is still valid', async () => {
			mockStore.read.mockReturnValue(freshSession());

			await buildService().refresh();

			expect(mockLoginClient.login).toHaveBeenCalledTimes(1);
		});
	});
});
