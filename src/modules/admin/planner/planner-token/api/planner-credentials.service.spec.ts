import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ScraperCredentialService } from 'src/modules/admin/scraping/credentials/api/scraper-credentials.service';
import { SCRAPER_PROVIDER_CODES } from 'src/modules/admin/scraping/credentials/constants/scraper-provider-codes';
import { ScraperCredentialValidation } from 'src/modules/admin/scraping/credentials/core/scraper-credentials.validation';
import type { SaveScraperCredentialInput } from 'src/modules/admin/scraping/credentials/model/scraper-credentials.dtos';
import { PlannerLoginClient } from '../core/planner-login.client';

import {
	PlannerLoginRejectedError,
	PlannerLoginUnreachableError,
} from '../model/planner-session.errors';
import { plannerSessionValidationStrings } from '../config/strings/planner-session.validation';
import { PlannerTokenSession } from '../model/planner-session.types';
import { PlannerTokenService } from './planner-token.service';
import { PlannerCredentialsService } from './planner-credentials.service';

const NEW_SESSION: PlannerTokenSession = {
	userId: 804988,
	accessToken: 'example-new-access-token',
	refreshToken: 'example-new-refresh-token',
	accessTokenExpiresAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
	refreshTokenExpiresAt: new Date(Date.now() + 14 * 3_600_000).toISOString(),
};

const PLAINTEXT = 'example-pw';
const DTO = { username: 'planner-operator', password: PLAINTEXT };

// `assertSavable` delegates to the real rule rather than a no-op: it is the pre-check that stops a
// whitespace username reaching a live login, so stubbing it out would make those cases pass for the
// wrong reason.
const mockCredentials = {
	save: jest.fn(),
	getSummary: jest.fn(),
	assertSavable: jest.fn((input: SaveScraperCredentialInput) =>
		ScraperCredentialValidation.validateSave(input),
	),
};
const mockLoginClient = { login: jest.fn() };
const mockTokenService = { getStatus: jest.fn(), adoptSession: jest.fn() };

const buildService = () =>
	new PlannerCredentialsService(
		mockCredentials as unknown as ScraperCredentialService,
		mockLoginClient as unknown as PlannerLoginClient,
		mockTokenService as unknown as PlannerTokenService,
	);

describe('PlannerCredentialsService', () => {
	// Every implementation is set explicitly: `clearAllMocks` resets calls but NOT implementations,
	// so a `mockRejectedValue` from one case otherwise leaks into the next.
	beforeEach(() => {
		jest.clearAllMocks();
		mockLoginClient.login.mockResolvedValue(NEW_SESSION);
		mockCredentials.save.mockResolvedValue(undefined);
		mockCredentials.getSummary.mockResolvedValue(undefined);
		mockCredentials.assertSavable.mockImplementation((input: SaveScraperCredentialInput) =>
			ScraperCredentialValidation.validateSave(input),
		);
		mockTokenService.adoptSession.mockReturnValue(undefined);
		mockTokenService.getStatus.mockResolvedValue({
			status: 'active',
			tokenExp: NEW_SESSION.accessTokenExpiresAt,
		});
	});

	describe('save', () => {
		it('verifies the credentials against u-planner before persisting anything', async () => {
			await buildService().save(DTO);

			expect(mockLoginClient.login).toHaveBeenCalledWith('planner-operator', PLAINTEXT);
			expect(mockCredentials.save).toHaveBeenCalledWith({
				providerCode: SCRAPER_PROVIDER_CODES.PLANNER,
				username: 'planner-operator',
				password: PLAINTEXT,
			});
			expect(mockTokenService.adoptSession).toHaveBeenCalledWith(NEW_SESSION);
		});

		it('reports the resulting session status', async () => {
			await expect(buildService().save(DTO)).resolves.toEqual({
				status: 'active',
				tokenExp: NEW_SESSION.accessTokenExpiresAt,
			});
		});

		it('writes nothing when u-planner rejects the credentials', async () => {
			mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('401'));

			await expect(buildService().save(DTO)).rejects.toMatchObject({
				messageKey: plannerSessionValidationStrings.error.invalidCredentials,
			});

			expect(mockCredentials.save).not.toHaveBeenCalled();
			expect(mockTokenService.adoptSession).not.toHaveBeenCalled();
		});

		it('distinguishes an unreachable u-planner from rejected credentials', async () => {
			mockLoginClient.login.mockRejectedValue(new PlannerLoginUnreachableError('ECONNREFUSED'));

			const error = await buildService()
				.save(DTO)
				.catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ServiceUnavailableException);
			expect((error as ServiceUnavailableException).message).toBe(
				plannerSessionValidationStrings.error.unreachable,
			);
			expect(mockCredentials.save).not.toHaveBeenCalled();
			expect(mockTokenService.adoptSession).not.toHaveBeenCalled();
		});

		// Routed through the token service rather than the store: one writer, and it clears the cooldown.
		it('hands the freshly obtained session to the token service', async () => {
			await buildService().save(DTO);

			expect(mockTokenService.adoptSession).toHaveBeenCalledTimes(1);
			expect(mockTokenService.adoptSession.mock.calls[0][0].accessToken).toBe(
				'example-new-access-token',
			);
		});

		it('persists the credentials before reporting a status', async () => {
			await buildService().save(DTO);

			expect(mockCredentials.save.mock.invocationCallOrder[0]).toBeLessThan(
				mockTokenService.getStatus.mock.invocationCallOrder[0],
			);
			expect(mockTokenService.adoptSession.mock.invocationCallOrder[0]).toBeLessThan(
				mockTokenService.getStatus.mock.invocationCallOrder[0],
			);
		});

		it('does not store the session when the credential write fails', async () => {
			mockCredentials.save.mockRejectedValue(new Error('db down'));

			await expect(buildService().save(DTO)).rejects.toThrow('db down');
			expect(mockTokenService.adoptSession).not.toHaveBeenCalled();
		});

		it('rethrows an unexpected login error unwrapped', async () => {
			mockLoginClient.login.mockRejectedValue(new TypeError('programmer error'));

			await expect(buildService().save(DTO)).rejects.toThrow(TypeError);
			expect(mockCredentials.save).not.toHaveBeenCalled();
		});

		it('trims the username before verifying and storing', async () => {
			await buildService().save({ username: '  planner-operator  ', password: PLAINTEXT });

			expect(mockLoginClient.login).toHaveBeenCalledWith('planner-operator', PLAINTEXT);
			expect(mockCredentials.save.mock.calls[0][0].username).toBe('planner-operator');
		});

		// Refused for free, before a live login attempt is spent on it and before the 30s penalty is
		// armed against every other operator.
		it.each([
			['only whitespace', '   '],
			['empty', ''],
		])('refuses a username that is %s without contacting u-planner', async (_label, username) => {
			await expect(buildService().save({ username, password: PLAINTEXT })).rejects.toBeDefined();

			expect(mockLoginClient.login).not.toHaveBeenCalled();
			expect(mockCredentials.save).not.toHaveBeenCalled();
		});

		// The type guarantee cannot come from the DTO: the global pipe's implicit conversion
		// stringifies before any validator runs, so this would otherwise be spent on a real login as
		// the literal "[object Object]".
		it.each([
			['an object', { a: 1 }],
			['a number', 12345],
		])('refuses a password that is %s without contacting u-planner', async (_label, password) => {
			await expect(
				buildService().save({ username: 'planner-operator', password }),
			).rejects.toBeDefined();

			expect(mockLoginClient.login).not.toHaveBeenCalled();
			expect(mockCredentials.save).not.toHaveBeenCalled();
		});

		it('never puts the password in the thrown error', async () => {
			mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('401'));

			const error = await buildService()
				.save(DTO)
				.catch((e: unknown) => e);

			expect(JSON.stringify(error)).not.toContain(PLAINTEXT);
		});
	});

	/**
	 * Every branch here throws an i18n key, and `AllExceptionsFilter` deliberately logs only messages
	 * that are *not* i18n keys — so without a logger of its own this endpoint answers 400/503 with no
	 * server-side record at all. That is the failure the whole change exists to remove, and it was
	 * reintroduced on the endpoint the change added.
	 */
	describe('failure paths are never silent', () => {
		let logged: unknown[];

		beforeEach(() => {
			logged = [];
			const collect = (...args: unknown[]) => void logged.push(...args);
			for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
				jest.spyOn(Logger.prototype, level).mockImplementation(collect);
			}
		});

		afterEach(() => {
			// Guards the guard: a case that logs nothing passes the secret checks while proving nothing.
			expect(logged.length).toBeGreaterThan(0);

			const output = logged.join(' ');
			expect(output).not.toContain(PLAINTEXT);
			expect(output).not.toContain(NEW_SESSION.accessToken);
			expect(output).not.toContain(NEW_SESSION.refreshToken);
		});

		afterEach(() => jest.restoreAllMocks());

		it('logs why a rejected pair was refused', async () => {
			mockLoginClient.login.mockRejectedValue(
				new PlannerLoginRejectedError('Planner rejected the login (401)'),
			);

			await expect(buildService().save(DTO)).rejects.toBeDefined();

			expect(logged.join(' ')).toContain('Planner rejected the login (401)');
		});

		it('logs why an unreachable u-planner produced a 503', async () => {
			mockLoginClient.login.mockRejectedValue(
				new PlannerLoginUnreachableError('Planner did not answer at https://example.test'),
			);

			await expect(buildService().save(DTO)).rejects.toBeInstanceOf(ServiceUnavailableException);

			expect(logged.join(' ')).toContain('did not answer');
		});

		it('logs when the throttle short-circuits an attempt', async () => {
			mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('401'));
			const service = buildService();

			await expect(service.save(DTO)).rejects.toBeDefined();
			await expect(service.save(DTO)).rejects.toMatchObject({
				messageKey: plannerSessionValidationStrings.error.verificationCooldown,
			});

			expect(logged.join(' ')).toContain('short-circuited by the throttle');
		});
	});

	// Without the throttle this endpoint is an oracle: any holder of the scraping permission could
	// test arbitrary credentials against the university's u-planner from this server's address.
	describe('verification throttle', () => {
		it('refuses a second attempt straight after a rejection', async () => {
			mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('401'));
			const service = buildService();

			await expect(service.save(DTO)).rejects.toMatchObject({
				messageKey: plannerSessionValidationStrings.error.invalidCredentials,
			});
			await expect(service.save(DTO)).rejects.toMatchObject({
				messageKey: plannerSessionValidationStrings.error.verificationCooldown,
			});

			expect(mockLoginClient.login).toHaveBeenCalledTimes(1);
		});

		it('refuses concurrent attempts, not just sequential ones', async () => {
			let releaseLogin: () => void = () => undefined;
			mockLoginClient.login.mockReturnValue(
				new Promise((_, reject) => {
					releaseLogin = () => reject(new PlannerLoginRejectedError('401'));
				}),
			);
			const service = buildService();

			const first = service.save(DTO).catch((e: unknown) => e);
			const second = await service.save(DTO).catch((e: unknown) => e);
			releaseLogin();
			await first;

			expect(second).toMatchObject({
				messageKey: plannerSessionValidationStrings.error.verificationCooldown,
			});
			expect(mockLoginClient.login).toHaveBeenCalledTimes(1);
		});

		it('measures the penalty from the rejection, not from the request', async () => {
			jest.useFakeTimers({ doNotFake: ['performance'] });
			try {
				mockLoginClient.login.mockImplementation(() => {
					jest.advanceTimersByTime(20_000);
					return Promise.reject(new PlannerLoginRejectedError('401'));
				});
				const service = buildService();
				await expect(service.save(DTO)).rejects.toBeDefined();

				mockLoginClient.login.mockResolvedValue(NEW_SESSION);
				jest.advanceTimersByTime(25_000);
				await expect(service.save(DTO)).rejects.toMatchObject({
					messageKey: plannerSessionValidationStrings.error.verificationCooldown,
				});

				jest.advanceTimersByTime(10_000);
				await expect(service.save(DTO)).resolves.toMatchObject({ status: 'active' });
			} finally {
				jest.useRealTimers();
			}
		});

		it('releases the slot when the login throws something unexpected', async () => {
			mockLoginClient.login.mockRejectedValueOnce(new TypeError('programmer error'));
			const service = buildService();

			await expect(service.save(DTO)).rejects.toThrow(TypeError);

			mockLoginClient.login.mockResolvedValue(NEW_SESSION);
			await expect(service.save(DTO)).resolves.toMatchObject({ status: 'active' });
		});

		it('does not throttle after an unreachable u-planner', async () => {
			mockLoginClient.login.mockRejectedValue(new PlannerLoginUnreachableError('ECONNREFUSED'));
			const service = buildService();

			await expect(service.save(DTO)).rejects.toBeInstanceOf(ServiceUnavailableException);
			await expect(service.save(DTO)).rejects.toBeInstanceOf(ServiceUnavailableException);

			expect(mockLoginClient.login).toHaveBeenCalledTimes(2);
		});

		it('releases the throttle once it has elapsed', async () => {
			jest.useFakeTimers({ doNotFake: ['performance'] });
			try {
				mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('401'));
				const service = buildService();

				await expect(service.save(DTO)).rejects.toBeDefined();
				jest.advanceTimersByTime(31_000);
				await expect(service.save(DTO)).rejects.toBeDefined();

				expect(mockLoginClient.login).toHaveBeenCalledTimes(2);
			} finally {
				jest.useRealTimers();
			}
		});

		// The claim is taken on entry and must outlast the login it guards. Shortened to the penalty
		// alone it would lapse at the tail of a slow call, and a second attempt would slip in behind
		// one still running — which is the whole hole the owned claim was introduced to close.
		it('holds the slot for longer than a login can take', async () => {
			jest.useFakeTimers({ doNotFake: ['performance'] });
			try {
				mockLoginClient.login.mockReturnValue(new Promise(() => undefined));
				const service = buildService();

				const held = service.save(DTO).catch(() => undefined);
				// Past a 30s login, still inside the claim.
				jest.advanceTimersByTime(45_000);

				await expect(service.save(DTO)).rejects.toMatchObject({
					messageKey: plannerSessionValidationStrings.error.verificationCooldown,
				});
				expect(mockLoginClient.login).toHaveBeenCalledTimes(1);
				void held;
			} finally {
				jest.useRealTimers();
			}
		});

		// Two attempts can only overlap if the first one's claim lapses under it, which the sizing
		// above prevents — but the ownership guards are what stop that becoming a security hole if it
		// ever does, so they are pinned independently of the sizing that makes them unreachable.
		describe('claim ownership', () => {
			it('does not let a later success erase a penalty another attempt armed', async () => {
				jest.useFakeTimers({ doNotFake: ['performance'] });
				try {
					let rejectFirst: () => void = () => undefined;
					let resolveSecond: () => void = () => undefined;
					mockLoginClient.login
						.mockReturnValueOnce(
							new Promise((_resolve, reject) => {
								rejectFirst = () => reject(new PlannerLoginRejectedError('401'));
							}),
						)
						.mockReturnValueOnce(
							new Promise((resolve) => {
								resolveSecond = () => resolve(NEW_SESSION);
							}),
						);
					const service = buildService();

					const first = service.save(DTO).catch((e: unknown) => e);
					jest.advanceTimersByTime(61_000); // first claim lapses
					const second = service.save(DTO).catch((e: unknown) => e);

					jest.advanceTimersByTime(34_000);
					rejectFirst();
					await first;

					jest.advanceTimersByTime(1_000);
					resolveSecond();
					await second;

					jest.advanceTimersByTime(4_000);
					await expect(service.save(DTO)).rejects.toMatchObject({
						messageKey: plannerSessionValidationStrings.error.verificationCooldown,
					});
					expect(mockLoginClient.login).toHaveBeenCalledTimes(2);
				} finally {
					jest.useRealTimers();
				}
			});

			it('does not let a penalty shorten a longer block already in place', async () => {
				jest.useFakeTimers({ doNotFake: ['performance'] });
				try {
					let rejectFirst: () => void = () => undefined;
					mockLoginClient.login
						.mockReturnValueOnce(
							new Promise((_resolve, reject) => {
								rejectFirst = () => reject(new PlannerLoginRejectedError('401'));
							}),
						)
						.mockReturnValueOnce(new Promise(() => undefined));
					const service = buildService();

					const first = service.save(DTO).catch((e: unknown) => e);
					jest.advanceTimersByTime(61_000); // first claim lapses
					const second = service.save(DTO).catch(() => undefined);

					// Rejects while the second attempt's claim still has longer to run than the
					// 30s penalty this rejection earns.
					rejectFirst();
					await first;

					jest.advanceTimersByTime(34_000);
					await expect(service.save(DTO)).rejects.toMatchObject({
						messageKey: plannerSessionValidationStrings.error.verificationCooldown,
					});
					expect(mockLoginClient.login).toHaveBeenCalledTimes(2);
					void second;
				} finally {
					jest.useRealTimers();
				}
			});
		});

		it('clears the throttle after a successful verification', async () => {
			mockLoginClient.login.mockRejectedValueOnce(new PlannerLoginRejectedError('401'));
			const service = buildService();

			await expect(service.save(DTO)).rejects.toBeDefined();
			jest.useFakeTimers({ doNotFake: ['performance'] });
			try {
				jest.advanceTimersByTime(31_000);
				await expect(service.save(DTO)).resolves.toMatchObject({ status: 'active' });
			} finally {
				jest.useRealTimers();
			}

			await expect(service.save(DTO)).resolves.toMatchObject({ status: 'active' });
		});
	});

	describe('getSummary', () => {
		// A pass-through, so this asserts delegation and nothing more. The "no password" guarantee
		// belongs to ScraperCredentialService, where its own spec proves it against a hostile row —
		// asserting it here against a mocked return value would only be testing the mock.
		it('delegates to the credential store for the Planner provider', async () => {
			const summary = {
				username: 'planner-operator',
				configured: true,
				updatedAt: new Date('2026-08-08T00:00:00.000Z'),
			};
			mockCredentials.getSummary.mockResolvedValue(summary);

			await expect(buildService().getSummary()).resolves.toBe(summary);
			expect(mockCredentials.getSummary).toHaveBeenCalledWith(SCRAPER_PROVIDER_CODES.PLANNER);
		});
	});
});
