import { UnauthorizedError } from 'src/commons/domain-error';
import { ApiTokenAuthGuard } from './api-token-auth.guard';
import { API_KEY_HEADER, API_TOKEN_PRINCIPAL } from '../api-key.constants';
import { API_TOKEN_AUTH_KEY } from '../decorators/api-token-auth.decorator';
import { IS_PUBLIC_KEY } from 'src/modules/auth/protocols/jwt/decorators/public.decorator';

describe('ApiTokenAuthGuard', () => {
	let reflector: { getAllAndOverride: jest.Mock };
	let authService: { resolve: jest.Mock };
	let guard: ApiTokenAuthGuard;
	let metadata: Record<string, boolean>;

	const principal = {
		apiTokenId: 1,
		keyId: 'abc123',
		name: 'Integration X',
		permissions: [{ module: 'ACADEMIC', permissions: ['GET'] }],
	};

	beforeEach(() => {
		metadata = {};
		reflector = {
			getAllAndOverride: jest.fn((key: string) => metadata[key]),
		};
		authService = {
			resolve: jest.fn().mockResolvedValue(principal),
		};
		guard = new ApiTokenAuthGuard(reflector as any, authService as any);
	});

	it('falls through when there is no X-Api-Key header', async () => {
		const { context, request } = createContext({});

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(request[API_TOKEN_PRINCIPAL]).toBeUndefined();
		expect(authService.resolve).not.toHaveBeenCalled();
	});

	it('ignores the header entirely on a public route', async () => {
		metadata[IS_PUBLIC_KEY] = true;
		const { context, request } = createContext({ [API_KEY_HEADER]: 'abc123.secret' });

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(request[API_TOKEN_PRINCIPAL]).toBeUndefined();
		expect(authService.resolve).not.toHaveBeenCalled();
	});

	it('rejects a valid-looking key on a route without @ApiTokenAuth() before any DB read', async () => {
		const { context } = createContext({ [API_KEY_HEADER]: 'abc123.secret' });

		await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
		expect(authService.resolve).not.toHaveBeenCalled();
	});

	it('rejects a malformed header value', async () => {
		metadata[API_TOKEN_AUTH_KEY] = true;
		const { context } = createContext({ [API_KEY_HEADER]: 'no-dot-here' });

		await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
		expect(authService.resolve).not.toHaveBeenCalled();
	});

	it('rejects a revoked token', async () => {
		metadata[API_TOKEN_AUTH_KEY] = true;
		authService.resolve.mockRejectedValue(new UnauthorizedError('error.apiToken.invalidApiKey'));
		const { context } = createContext({ [API_KEY_HEADER]: 'abc123.secret' });

		await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
	});

	it('rejects an expired token', async () => {
		metadata[API_TOKEN_AUTH_KEY] = true;
		authService.resolve.mockRejectedValue(new UnauthorizedError('error.apiToken.invalidApiKey'));
		const { context } = createContext({ [API_KEY_HEADER]: 'abc123.secret' });

		await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
	});

	it('rejects a wrong secret the same way as an unknown keyId', async () => {
		metadata[API_TOKEN_AUTH_KEY] = true;
		authService.resolve.mockRejectedValue(new UnauthorizedError('error.apiToken.invalidApiKey'));
		const { context } = createContext({ [API_KEY_HEADER]: 'abc123.wrong-secret' });

		await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
		expect(authService.resolve).toHaveBeenCalledWith('abc123', 'wrong-secret');
	});

	it('sets request.apiToken and never request.user on the happy path', async () => {
		metadata[API_TOKEN_AUTH_KEY] = true;
		const { context, request } = createContext({ [API_KEY_HEADER]: 'abc123.secret' });

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(request[API_TOKEN_PRINCIPAL]).toBe(principal);
		expect((request as any).user).toBeUndefined();
		expect(authService.resolve).toHaveBeenCalledWith('abc123', 'secret');
	});

	it('splits on the first "." only, keeping later dots as part of the secret', async () => {
		metadata[API_TOKEN_AUTH_KEY] = true;
		const { context } = createContext({ [API_KEY_HEADER]: 'abc123.se.cret' });

		await guard.canActivate(context);

		expect(authService.resolve).toHaveBeenCalledWith('abc123', 'se.cret');
	});

	it('performs zero compareSecret-triggering resolve calls for a route without opt-in (AC-11 partial)', async () => {
		const { context } = createContext({ [API_KEY_HEADER]: 'unknown-key.secret' });

		await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
		expect(authService.resolve).not.toHaveBeenCalled();
	});
});

function createContext(headers: Record<string, string>) {
	const request: Record<string, any> = { headers };
	const context = {
		getHandler: jest.fn(),
		getClass: jest.fn(),
		switchToHttp: () => ({
			getRequest: () => request,
		}),
	} as any;
	return { context, request };
}
