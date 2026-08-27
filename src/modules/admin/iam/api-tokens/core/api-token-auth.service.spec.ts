import { UnauthorizedError } from 'src/commons/domain-error';
import { compareSecret } from 'src/libs/secure.functions';
import { ApiTokenAuthService } from './api-token-auth.service';
import type { ApiTokenEntity } from '../model/api-token.entity';

jest.mock('src/libs/secure.functions', () => ({
	compareSecret: jest.fn(),
}));

const mockedCompareSecret = compareSecret as jest.Mock;

describe('ApiTokenAuthService', () => {
	let repository: { findAuthCandidateByKeyId: jest.Mock };
	let service: ApiTokenAuthService;

	const activeRow: ApiTokenEntity = {
		id: 1,
		keyId: 'abc123',
		name: 'Integration X',
		secretHash: 'hashed-secret',
		scopes: [{ module: 'ACADEMIC', action: 'GET' }],
		expiresAt: null,
		isActive: true,
	} as ApiTokenEntity;

	beforeEach(() => {
		jest.clearAllMocks();
		repository = {
			findAuthCandidateByKeyId: jest.fn(),
		};
		service = new ApiTokenAuthService(repository as any);
	});

	// AC-11: exactly one candidate row loaded by keyId, at most one bcrypt comparison.

	it('returns a principal for a valid key, reading exactly one row and comparing the secret exactly once', async () => {
		repository.findAuthCandidateByKeyId.mockResolvedValue(activeRow);
		mockedCompareSecret.mockResolvedValue(true);

		const principal = await service.resolve('abc123', 'secret');

		expect(principal).toEqual({
			apiTokenId: 1,
			keyId: 'abc123',
			name: 'Integration X',
			permissions: [{ module: 'ACADEMIC', permissions: ['GET'] }],
		});
		expect(repository.findAuthCandidateByKeyId).toHaveBeenCalledTimes(1);
		expect(repository.findAuthCandidateByKeyId).toHaveBeenCalledWith('abc123');
		expect(mockedCompareSecret).toHaveBeenCalledTimes(1);
		expect(mockedCompareSecret).toHaveBeenCalledWith('secret', 'hashed-secret');
	});

	it('rejects an unknown keyId without ever calling compareSecret', async () => {
		repository.findAuthCandidateByKeyId.mockResolvedValue(null);

		await expect(service.resolve('unknown-key', 'secret')).rejects.toThrow(UnauthorizedError);

		expect(repository.findAuthCandidateByKeyId).toHaveBeenCalledTimes(1);
		expect(mockedCompareSecret).not.toHaveBeenCalled();
	});

	it('rejects a revoked (inactive) token without ever calling compareSecret', async () => {
		repository.findAuthCandidateByKeyId.mockResolvedValue({ ...activeRow, isActive: false });

		await expect(service.resolve('abc123', 'secret')).rejects.toThrow(UnauthorizedError);

		expect(repository.findAuthCandidateByKeyId).toHaveBeenCalledTimes(1);
		expect(mockedCompareSecret).not.toHaveBeenCalled();
	});

	it('rejects an expired token without ever calling compareSecret', async () => {
		repository.findAuthCandidateByKeyId.mockResolvedValue({
			...activeRow,
			expiresAt: new Date('2000-01-01T00:00:00.000Z'),
		});

		await expect(service.resolve('abc123', 'secret')).rejects.toThrow(UnauthorizedError);

		expect(repository.findAuthCandidateByKeyId).toHaveBeenCalledTimes(1);
		expect(mockedCompareSecret).not.toHaveBeenCalled();
	});

	it('rejects a wrong secret after exactly one comparison, loading exactly one row', async () => {
		repository.findAuthCandidateByKeyId.mockResolvedValue(activeRow);
		mockedCompareSecret.mockResolvedValue(false);

		await expect(service.resolve('abc123', 'wrong-secret')).rejects.toThrow(UnauthorizedError);

		expect(repository.findAuthCandidateByKeyId).toHaveBeenCalledTimes(1);
		expect(mockedCompareSecret).toHaveBeenCalledTimes(1);
		expect(mockedCompareSecret).toHaveBeenCalledWith('wrong-secret', 'hashed-secret');
	});
});
