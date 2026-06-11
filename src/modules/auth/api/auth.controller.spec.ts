import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

type AuthServiceMock = {
	buildMicrosoftLoginUrl: jest.Mock;
	loginWithMicrosoftCode: jest.Mock;
};

const TEST_JWT_SECRET = 'a]3kF8xQ!mZ#9pLw$7rNv&2jYh^0sTbC';

function fakeConfigService(): ConfigService {
	return { get: () => TEST_JWT_SECRET } as unknown as ConfigService;
}

function fakeResponse(cookies: Record<string, string> = {}) {
	const cookieJar: Record<string, unknown> = {};
	const res = {
		cookie: jest.fn((name: string, value: unknown) => {
			cookieJar[name] = value;
		}),
		clearCookie: jest.fn((name: string) => {
			delete cookieJar[name];
		}),
		redirect: jest.fn(),
		req: { cookies },
	};
	return { res, cookieJar };
}

function signState(csrf: string): string {
	const encoded = Buffer.from(JSON.stringify({ csrf })).toString('base64url');
	const signature = createHmac('sha256', TEST_JWT_SECRET).update(encoded).digest('base64url');
	return `${encoded}.${signature}`;
}

describe('AuthController — MSAL state packing', () => {
	let controller: AuthController;
	let authService: AuthServiceMock;

	beforeEach(() => {
		authService = {
			buildMicrosoftLoginUrl: jest.fn(),
			loginWithMicrosoftCode: jest.fn(),
		};
		controller = new AuthController(authService as unknown as AuthService, fakeConfigService());
	});

	describe('GET /microsoft', () => {
		it('packs csrf into an HMAC-signed state, sets csrf cookie, and redirects', async () => {
			authService.buildMicrosoftLoginUrl.mockResolvedValueOnce(
				'https://login.microsoftonline.com/url?state=...',
			);
			const { res, cookieJar } = fakeResponse();

			await controller.loginWithMicrosoft(res as never);

			expect(authService.buildMicrosoftLoginUrl).toHaveBeenCalledTimes(1);

			const passedState: string = authService.buildMicrosoftLoginUrl.mock.calls[0][0];
			const dotIndex = passedState.lastIndexOf('.');
			expect(dotIndex).toBeGreaterThan(0);

			const encoded = passedState.substring(0, dotIndex);
			const signature = passedState.substring(dotIndex + 1);
			const expectedSig = createHmac('sha256', TEST_JWT_SECRET).update(encoded).digest('base64url');
			expect(signature).toBe(expectedSig);

			const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString());
			expect(typeof parsed.csrf).toBe('string');
			expect(parsed.csrf.length).toBeGreaterThan(0);

			expect(res.cookie).toHaveBeenCalledWith(
				'microsoftOauthState',
				parsed.csrf,
				expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
			);
			expect(cookieJar['microsoftOauthState']).toBe(parsed.csrf);
			expect(res.redirect).toHaveBeenCalledWith('https://login.microsoftonline.com/url?state=...');
		});
	});

	describe('GET /callback/azure-ad', () => {
		it('throws when CSRF in state does not match the cookie', async () => {
			const state = signState('expected-csrf');
			const { res } = fakeResponse({ microsoftOauthState: 'different-csrf' });

			await expect(
				controller.microsoftCallback('code-abc', state, res as never),
			).rejects.toBeInstanceOf(UnauthorizedException);
			expect(authService.loginWithMicrosoftCode).not.toHaveBeenCalled();
		});

		it('throws when state is missing or malformed', async () => {
			const { res } = fakeResponse({ microsoftOauthState: 'whatever' });
			await expect(
				controller.microsoftCallback('code-abc', '', res as never),
			).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(
				controller.microsoftCallback('code-abc', 'not-json', res as never),
			).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it('throws when HMAC signature is tampered', async () => {
			const state = signState('matching-csrf');
			const tampered = state.slice(0, -4) + 'XXXX';
			const { res } = fakeResponse({ microsoftOauthState: 'matching-csrf' });

			await expect(
				controller.microsoftCallback('code-abc', tampered, res as never),
			).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it('validates signed state and calls loginWithMicrosoftCode', async () => {
			const state = signState('matching-csrf');
			const { res } = fakeResponse({ microsoftOauthState: 'matching-csrf' });
			authService.loginWithMicrosoftCode.mockResolvedValueOnce({
				user: { id: 1 },
				microsoftProfile: { email: 'a@b.com', name: 'A' },
				accessToken: 'tok',
			});

			const result = await controller.microsoftCallback('code-abc', state, res as never);

			expect(authService.loginWithMicrosoftCode).toHaveBeenCalledWith('code-abc');
			expect(res.clearCookie).toHaveBeenCalledWith('microsoftOauthState');
			expect(result).toMatchObject({
				code: 200,
				data: expect.objectContaining({ accessToken: 'tok' }),
			});
		});
	});
});
