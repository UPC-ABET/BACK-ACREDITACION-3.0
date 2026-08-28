import { NotFoundError, BadRequestError } from 'src/commons/domain-error';
import { PortfolioSsoService } from './portfolio-sso.service';

describe('PortfolioSsoService', () => {
	let repository: {
		getConfig: jest.Mock;
		getConfigWithSecret: jest.Mock;
		upsertSingleton: jest.Mock;
	};
	let userRepository: { findOneById: jest.Mock };
	let encryptService: { encrypt: jest.Mock; decrypt: jest.Mock };
	let service: PortfolioSsoService;

	beforeEach(() => {
		repository = {
			getConfig: jest.fn(),
			getConfigWithSecret: jest.fn(),
			upsertSingleton: jest.fn(),
		};
		userRepository = { findOneById: jest.fn() };
		encryptService = {
			encrypt: jest.fn().mockReturnValue('iv:ct:tag'),
			decrypt: jest.fn().mockReturnValue('plain-api-key'), // abet-allow-secret: test fixture
		};
		service = new PortfolioSsoService(
			repository as any,
			userRepository as any,
			encryptService as any,
		);
	});

	describe('getConfigSummary', () => {
		it('reports configured=false and empty baseUrl when no row exists', async () => {
			repository.getConfig.mockResolvedValue(null);

			const result = await service.getConfigSummary();

			expect(result).toEqual({ baseUrl: '', configured: false, updatedAt: null });
		});

		it('never includes apiKey in the summary, even when configured', async () => {
			repository.getConfig.mockResolvedValue({
				id: 1,
				baseUrl: 'https://portfolio.example.edu',
				updatedAt: new Date('2026-01-01T00:00:00.000Z'),
			});

			const result = await service.getConfigSummary();

			expect(result).toEqual({
				baseUrl: 'https://portfolio.example.edu',
				configured: true,
				updatedAt: new Date('2026-01-01T00:00:00.000Z'),
			});
			expect(result).not.toHaveProperty('apiKey');
			expect(result).not.toHaveProperty('apiKeyEncrypted');
		});
	});

	describe('upsertConfig', () => {
		it('encrypts the apiKey and normalizes baseUrl before persisting', async () => {
			repository.upsertSingleton.mockResolvedValue({
				id: 1,
				baseUrl: 'https://portfolio.example.edu',
				updatedAt: new Date('2026-01-01T00:00:00.000Z'),
			});

			const result = await service.upsertConfig({
				baseUrl: 'https://portfolio.example.edu/',
				apiKey: 'a'.repeat(32),
			});

			expect(encryptService.encrypt).toHaveBeenCalledWith('a'.repeat(32));
			expect(repository.upsertSingleton).toHaveBeenCalledWith(
				'https://portfolio.example.edu',
				'iv:ct:tag',
			);
			expect(result.configured).toBe(true);
		});

		it('rejects an apiKey shorter than 32 characters before touching the repository', async () => {
			await expect(
				service.upsertConfig({ baseUrl: 'https://portfolio.example.edu', apiKey: 'short' }),
			).rejects.toThrow(BadRequestError);

			expect(repository.upsertSingleton).not.toHaveBeenCalled();
		});
	});

	describe('buildLoginLink', () => {
		it('throws NotFoundError when no config row exists', async () => {
			repository.getConfigWithSecret.mockResolvedValue(null);

			await expect(service.buildLoginLink(1)).rejects.toThrow(NotFoundError);
			expect(userRepository.findOneById).not.toHaveBeenCalled();
		});

		it('builds a URL from baseUrl and a signed token using the requesting user profile', async () => {
			repository.getConfigWithSecret.mockResolvedValue({
				id: 1,
				baseUrl: 'https://portfolio.example.edu',
				apiKeyEncrypted: 'iv:ct:tag',
			});
			userRepository.findOneById.mockResolvedValue({
				id: 7,
				email: 'jane.doe@upc.edu.pe',
				firstName: 'Jane',
				lastName: 'Doe',
			});

			const result = await service.buildLoginLink(7);

			expect(encryptService.decrypt).toHaveBeenCalledWith('iv:ct:tag');
			expect(result.url).toMatch(/^https:\/\/portfolio\.example\.edu\/auth\/externo\?token=.+$/);
		});

		it('throws NotFoundError when the requesting user profile is missing', async () => {
			repository.getConfigWithSecret.mockResolvedValue({
				id: 1,
				baseUrl: 'https://portfolio.example.edu',
				apiKeyEncrypted: 'iv:ct:tag',
			});
			userRepository.findOneById.mockResolvedValue(null);

			await expect(service.buildLoginLink(999)).rejects.toThrow(NotFoundError);
		});
	});
});
