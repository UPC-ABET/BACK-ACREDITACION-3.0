import { of, throwError } from 'rxjs';
import { EncryptedResponseInterceptor } from './encrypted-response.interceptor';
import { API_TOKEN_PRINCIPAL } from 'src/modules/auth/protocols/api-key/api-key.constants';

function buildContext(request: Record<string, any>) {
	return {
		getHandler: () => ({}),
		getClass: () => ({}),
		switchToHttp: () => ({ getRequest: () => request }),
	} as any;
}

describe('EncryptedResponseInterceptor', () => {
	it('passes through unchanged when the route has no @EncryptedResponse() metadata', (done) => {
		const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
		const responseEncryptionService = { encryptForApiToken: jest.fn() };
		const interceptor = new EncryptedResponseInterceptor(
			reflector as any,
			responseEncryptionService as any,
		);
		const body = { code: 200, message: 'success.ok', data: { ok: true } };
		const next = { handle: () => of(body) };

		interceptor.intercept(buildContext({}), next as any).subscribe((result) => {
			expect(result).toBe(body);
			expect(responseEncryptionService.encryptForApiToken).not.toHaveBeenCalled();
			done();
		});
	});

	it('passes through unencrypted when there is no machine principal on the request', (done) => {
		const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
		const responseEncryptionService = { encryptForApiToken: jest.fn() };
		const interceptor = new EncryptedResponseInterceptor(
			reflector as any,
			responseEncryptionService as any,
		);
		const body = { code: 200, message: 'success.ok', data: { ok: true } };
		const next = { handle: () => of(body) };

		interceptor.intercept(buildContext({}), next as any).subscribe((result) => {
			expect(result).toBe(body);
			expect(responseEncryptionService.encryptForApiToken).not.toHaveBeenCalled();
			done();
		});
	});

	it('encrypts `data` when the route opts in and a machine principal is present', (done) => {
		const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
		const responseEncryptionService = {
			encryptForApiToken: jest.fn().mockResolvedValue('iv:ct:tag'),
		};
		const interceptor = new EncryptedResponseInterceptor(
			reflector as any,
			responseEncryptionService as any,
		);
		const body = { code: 200, message: 'success.ok', data: { ok: true } };
		const next = { handle: () => of(body) };
		const request = {
			[API_TOKEN_PRINCIPAL]: { apiTokenId: 7, keyId: 'k', name: 'n', permissions: [] },
		};

		interceptor.intercept(buildContext(request), next as any).subscribe((result: any) => {
			expect(result.data).toBe('iv:ct:tag');
			expect(result.code).toBe(200);
			expect(result.message).toBe('success.ok');
			expect(responseEncryptionService.encryptForApiToken).toHaveBeenCalledWith(7, { ok: true });
			done();
		});
	});

	it('propagates a rejection from the encryption service', (done) => {
		const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
		const responseEncryptionService = {
			encryptForApiToken: jest.fn().mockRejectedValue(new Error('no key provisioned')),
		};
		const interceptor = new EncryptedResponseInterceptor(
			reflector as any,
			responseEncryptionService as any,
		);
		const body = { code: 200, message: 'success.ok', data: { ok: true } };
		const next = { handle: () => of(body) };
		const request = {
			[API_TOKEN_PRINCIPAL]: { apiTokenId: 7, keyId: 'k', name: 'n', permissions: [] },
		};

		interceptor.intercept(buildContext(request), next as any).subscribe({
			error: (err) => {
				expect(err.message).toBe('no key provisioned');
				done();
			},
		});
	});

	it('never intercepts an error emitted before the pipe (sanity check)', (done) => {
		const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
		const responseEncryptionService = { encryptForApiToken: jest.fn() };
		const interceptor = new EncryptedResponseInterceptor(
			reflector as any,
			responseEncryptionService as any,
		);
		const next = { handle: () => throwError(() => new Error('handler failed')) };
		const request = {
			[API_TOKEN_PRINCIPAL]: { apiTokenId: 7, keyId: 'k', name: 'n', permissions: [] },
		};

		interceptor.intercept(buildContext(request), next as any).subscribe({
			error: (err) => {
				expect(err.message).toBe('handler failed');
				expect(responseEncryptionService.encryptForApiToken).not.toHaveBeenCalled();
				done();
			},
		});
	});
});
