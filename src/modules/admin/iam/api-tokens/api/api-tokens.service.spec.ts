import { ApiTokenService } from './api-tokens.service';

jest.mock('src/libs/secure.functions', () => ({
	hashPassword: jest.fn().mockResolvedValue('hashed-secret'),
	generateApiKeyMaterial: jest.fn().mockReturnValue({ keyId: 'abc123', secret: 'plain-secret' }), // abet-allow-secret: test fixture, not a real credential
}));

describe('ApiTokenService', () => {
	let repository: {
		create: jest.Mock;
		update: jest.Mock;
		findOneById: jest.Mock;
		remove: jest.Mock;
	};
	let service: ApiTokenService;

	beforeEach(() => {
		repository = {
			create: jest.fn().mockImplementation(async (data: any) => ({
				id: 1,
				createdAt: new Date('2026-01-01T00:00:00.000Z'),
				secretHash: 'hashed-secret',
				...data,
			})),
			update: jest.fn().mockResolvedValue({ id: 1, isActive: false }),
			findOneById: jest.fn().mockResolvedValue({ id: 1, isActive: true, revokedAt: null }),
			remove: jest.fn(),
		};
		service = new ApiTokenService(repository as any);
	});

	describe('create', () => {
		it('never returns secretHash on the response', async () => {
			const result = await service.issue(
				{ name: 'Integration X', scopes: [{ module: 'ADMIN', action: 'GET' }] } as any,
				1,
			);

			expect(result).not.toHaveProperty('secretHash');
		});

		it('returns apiKey exactly once, built from keyId and the plaintext secret', async () => {
			const result = await service.issue(
				{ name: 'Integration X', scopes: [{ module: 'ADMIN', action: 'GET' }] } as any,
				1,
			);

			expect(result.apiKey).toBe('abc123.plain-secret');
		});

		it('takes createdByUserId from the caller argument, not the body', async () => {
			await service.issue(
				{
					name: 'Integration X',
					scopes: [{ module: 'ADMIN', action: 'GET' }],
					createdByUserId: 999,
				} as any,
				1,
			);

			const created = repository.create.mock.calls[0][0];
			expect(created.createdByUserId).toBe(1);
		});
	});

	describe('delete', () => {
		it('performs a soft revoke and never calls repository.remove', async () => {
			await service.revoke(1, 42);

			expect(repository.remove).not.toHaveBeenCalled();
			expect(repository.update).toHaveBeenCalledWith(
				1,
				expect.objectContaining({
					isActive: false,
					revokedByUserId: 42,
					revokedAt: expect.any(Date),
				}),
				undefined,
			);
		});
	});
});
