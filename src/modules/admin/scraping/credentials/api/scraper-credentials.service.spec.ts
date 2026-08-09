import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from 'src/commons/domain-error';
import { EncryptService } from 'src/libs/encrypt.service';
import { SCRAPER_PROVIDER_CODES } from '../constants/scraper-provider-codes';
import { scraperCredentialsValidationStrings } from '../config/strings/scraper-credentials.validation';
import { ScraperCredentialRepository } from '../core/scraper-credentials.repository';
import { ScraperCredentialService } from './scraper-credentials.service';

const PLAINTEXT = 'example-pw';

const mockRepo = {
	findByProvider: jest.fn(),
	findByProviderWithPassword: jest.fn(),
	upsertForProvider: jest.fn(),
};

// A real EncryptService, not a mock: a mocked round-trip proves nothing about whether the stored
// password can actually be recovered, which is the only thing that matters here.
const buildEncryptService = () =>
	new EncryptService({ get: () => 'a'.repeat(64) } as unknown as ConfigService);

const buildService = () =>
	new ScraperCredentialService(
		mockRepo as unknown as ScraperCredentialRepository,
		buildEncryptService(),
	);

describe('ScraperCredentialService', () => {
	beforeEach(() => jest.clearAllMocks());

	describe('save', () => {
		it('stores ciphertext, never the plaintext password', async () => {
			mockRepo.upsertForProvider.mockResolvedValue({ id: 1 });

			await buildService().save({
				providerCode: SCRAPER_PROVIDER_CODES.PLANNER,
				username: 'planner-operator',
				password: PLAINTEXT,
			});

			const [, , stored] = mockRepo.upsertForProvider.mock.calls[0];
			expect(stored).not.toContain(PLAINTEXT);
			expect(stored).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
		});

		it('trims the username before storing', async () => {
			mockRepo.upsertForProvider.mockResolvedValue({ id: 1 });

			await buildService().save({
				providerCode: SCRAPER_PROVIDER_CODES.PLANNER,
				username: '  planner-operator  ',
				password: PLAINTEXT,
			});

			expect(mockRepo.upsertForProvider.mock.calls[0][1]).toBe('planner-operator');
		});

		it('rejects invalid input without touching the repository', async () => {
			await expect(
				buildService().save({
					providerCode: SCRAPER_PROVIDER_CODES.PLANNER,
					username: '',
					password: PLAINTEXT,
				}),
			).rejects.toThrow(DomainError);

			expect(mockRepo.upsertForProvider).not.toHaveBeenCalled();
		});
	});

	describe('getDecrypted', () => {
		it('round-trips the password back to the original plaintext', async () => {
			const service = buildService();
			mockRepo.upsertForProvider.mockResolvedValue({ id: 1 });

			await service.save({
				providerCode: SCRAPER_PROVIDER_CODES.PLANNER,
				username: 'planner-operator',
				password: PLAINTEXT,
			});
			const [, username, ciphertext] = mockRepo.upsertForProvider.mock.calls[0];

			mockRepo.findByProviderWithPassword.mockResolvedValue({
				username,
				passwordEncrypted: ciphertext,
			});

			await expect(service.getDecrypted(SCRAPER_PROVIDER_CODES.PLANNER)).resolves.toEqual({
				username: 'planner-operator',
				password: PLAINTEXT,
			});
		});

		it('returns null when the provider has never been configured', async () => {
			mockRepo.findByProviderWithPassword.mockResolvedValue(null);

			await expect(buildService().getDecrypted(SCRAPER_PROVIDER_CODES.PLANNER)).resolves.toBeNull();
		});

		// A changed APP_SECRET is a server misconfiguration, so it must not come back as a 400
		// blaming the caller — and it must never read as "invalid credentials".
		it('reports a decryption failure as a service fault, not as invalid credentials', async () => {
			mockRepo.findByProviderWithPassword.mockResolvedValue({
				username: 'planner-operator',
				passwordEncrypted: 'deadbeef:deadbeef:deadbeef',
			});

			const error = await buildService()
				.getDecrypted(SCRAPER_PROVIDER_CODES.PLANNER)
				.catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ServiceUnavailableException);
			expect((error as ServiceUnavailableException).message).toBe(
				scraperCredentialsValidationStrings.error.decryptionFailed,
			);
		});

		it('does not leak the ciphertext or plaintext into the decryption error', async () => {
			const ciphertext = 'deadbeef:deadbeef:deadbeef';
			mockRepo.findByProviderWithPassword.mockResolvedValue({
				username: 'planner-operator',
				passwordEncrypted: ciphertext,
			});

			const error = (await buildService()
				.getDecrypted(SCRAPER_PROVIDER_CODES.PLANNER)
				.catch((e: unknown) => e)) as Error;

			expect(error).toBeInstanceOf(Error);
			expect(`${error.message}${JSON.stringify(error)}`).not.toContain(ciphertext);
		});
	});

	// The sole predicate behind AC-9: it decides `not_configured` and whether refresh even tries.
	// Every test that looks like coverage elsewhere asserts a mocked ScraperCredentialService.
	describe('isConfigured', () => {
		it('is true when a row exists for the provider', async () => {
			mockRepo.findByProvider.mockResolvedValue({ id: 1, username: 'planner-operator' });

			await expect(buildService().isConfigured(SCRAPER_PROVIDER_CODES.PLANNER)).resolves.toBe(true);
			expect(mockRepo.findByProvider).toHaveBeenCalledWith(SCRAPER_PROVIDER_CODES.PLANNER);
		});

		it('is false when the provider has no row', async () => {
			mockRepo.findByProvider.mockResolvedValue(null);

			await expect(buildService().isConfigured(SCRAPER_PROVIDER_CODES.PLANNER)).resolves.toBe(
				false,
			);
		});
	});

	describe('getSummary', () => {
		// The row is deliberately hostile: it carries a ciphertext even though `select: false` means
		// production never loads one. A summary built by spreading the row would leak it, and this
		// is the assertion that catches that — a password-free fixture could not.
		it('returns the username and configured flag with no password field of any kind', async () => {
			mockRepo.findByProvider.mockResolvedValue({
				id: 1,
				providerCode: SCRAPER_PROVIDER_CODES.PLANNER,
				username: 'planner-operator',
				passwordEncrypted: 'aabb:ccdd:eeff',
				updatedAt: new Date('2026-08-08T00:00:00.000Z'),
			});

			const summary = await buildService().getSummary(SCRAPER_PROVIDER_CODES.PLANNER);

			expect(summary).toEqual({
				username: 'planner-operator',
				configured: true,
				updatedAt: new Date('2026-08-08T00:00:00.000Z'),
			});
			expect(JSON.stringify(summary)).not.toContain('aabb:ccdd:eeff');
			expect(Object.keys(summary)).not.toContain('passwordEncrypted');
		});

		it('reports not configured when no row exists', async () => {
			mockRepo.findByProvider.mockResolvedValue(null);

			await expect(buildService().getSummary(SCRAPER_PROVIDER_CODES.PLANNER)).resolves.toEqual({
				username: null,
				configured: false,
				updatedAt: null,
			});
		});
	});
});
