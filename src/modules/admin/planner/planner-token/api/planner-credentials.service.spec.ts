import { ServiceUnavailableException } from '@nestjs/common';
import { ScraperCredentialService } from 'src/modules/admin/scraping/credentials/api/scraper-credentials.service';
import { SCRAPER_PROVIDER_CODES } from 'src/modules/admin/scraping/credentials/constants/scraper-provider-codes';
import { PlannerLoginClient } from '../core/planner-login.client';

import {
	PlannerLoginRejectedError,
	PlannerLoginUnreachableError,
} from '../model/session-expired.error';
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

const mockCredentials = { save: jest.fn(), getSummary: jest.fn() };
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

		// AC-7: a rejected login must leave no trace at all.
		it('writes nothing when u-planner rejects the credentials', async () => {
			mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('401'));

			await expect(buildService().save(DTO)).rejects.toMatchObject({
				messageKey: plannerSessionValidationStrings.error.invalidCredentials,
			});

			expect(mockCredentials.save).not.toHaveBeenCalled();
			expect(mockTokenService.adoptSession).not.toHaveBeenCalled();
		});

		// An operator must never be told a correct password is wrong because u-planner was down.
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

		// AC-10: no session obtained under the old credentials may survive the write. Handing it to
		// the token service rather than the store keeps one writer and clears the refresh cooldown.
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

		it('never puts the password in the thrown error', async () => {
			mockLoginClient.login.mockRejectedValue(new PlannerLoginRejectedError('401'));

			const error = await buildService()
				.save(DTO)
				.catch((e: unknown) => e);

			expect(JSON.stringify(error)).not.toContain(PLAINTEXT);
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

		// The window runs from the response, not from entry — a slow rejection must still cost a
		// full penalty rather than whatever is left of the claim it was holding.
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
