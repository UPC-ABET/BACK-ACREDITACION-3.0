import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

type AuthServiceMock = {
	resolveSchoolIdByCode: jest.Mock;
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

function signState(csrf: string, school_id: number): string {
	const encoded = Buffer.from(JSON.stringify({ csrf, school_id })).toString('base64url');
	const signature = createHmac('sha256', TEST_JWT_SECRET).update(encoded).digest('base64url');
	return `${encoded}.${signature}`;
}

describe('AuthController — MSAL state packing', () => {
	let controller: AuthController;
	let authService: AuthServiceMock;

	beforeEach(() => {
		authService = {
			resolveSchoolIdByCode: jest.fn(),
			buildMicrosoftLoginUrl: jest.fn(),
			loginWithMicrosoftCode: jest.fn(),
		};
		controller = new AuthController(authService as unknown as AuthService, fakeConfigService());
	});

	describe('GET /microsoft', () => {
		it('rejects when school_code is missing', async () => {
			const { res } = fakeResponse();

			await expect(controller.loginWithMicrosoft('', res as never)).rejects.toMatchObject({
				constructor: HttpException,
				status: HttpStatus.BAD_REQUEST,
			});
			expect(authService.resolveSchoolIdByCode).not.toHaveBeenCalled();
		});

		it('packs {csrf, school_id} into an HMAC-signed state, sets csrf cookie, and redirects', async () => {
			authService.resolveSchoolIdByCode.mockResolvedValueOnce(7);
			authService.buildMicrosoftLoginUrl.mockResolvedValueOnce(
				'https://login.microsoftonline.com/url?state=...',
			);
			const { res, cookieJar } = fakeResponse();

			await controller.loginWithMicrosoft('EISCB', res as never);

			expect(authService.resolveSchoolIdByCode).toHaveBeenCalledWith('EISCB');
			expect(authService.buildMicrosoftLoginUrl).toHaveBeenCalledTimes(1);

			const passedState: string = authService.buildMicrosoftLoginUrl.mock.calls[0][0];
			const dotIndex = passedState.lastIndexOf('.');
			expect(dotIndex).toBeGreaterThan(0);

			const encoded = passedState.substring(0, dotIndex);
			const signature = passedState.substring(dotIndex + 1);
			const expectedSig = createHmac('sha256', TEST_JWT_SECRET).update(encoded).digest('base64url');
			expect(signature).toBe(expectedSig);

			const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString());
			expect(parsed).toMatchObject({ school_id: 7 });
			expect(typeof parsed.csrf).toBe('string');
			expect(parsed.csrf.length).toBeGreaterThan(0);

			expect(res.cookie).toHaveBeenCalledWith(
				'microsoft_oauth_state',
				parsed.csrf,
				expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
			);
			expect(cookieJar['microsoft_oauth_state']).toBe(parsed.csrf);
			expect(res.redirect).toHaveBeenCalledWith('https://login.microsoftonline.com/url?state=...');
		});
	});

	describe('GET /callback/azure-ad', () => {
		it('throws when CSRF in state does not match the cookie', async () => {
			const state = signState('expected-csrf', 7);
			const { res } = fakeResponse({ microsoft_oauth_state: 'different-csrf' });

			await expect(
				controller.microsoftCallback('code-abc', state, res as never),
			).rejects.toBeInstanceOf(UnauthorizedException);
			expect(authService.loginWithMicrosoftCode).not.toHaveBeenCalled();
		});

		it('throws when state is missing or malformed', async () => {
			const { res } = fakeResponse({ microsoft_oauth_state: 'whatever' });
			await expect(
				controller.microsoftCallback('code-abc', '', res as never),
			).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(
				controller.microsoftCallback('code-abc', 'not-json', res as never),
			).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it('throws when HMAC signature is tampered', async () => {
			const state = signState('matching-csrf', 7);
			const tampered = state.slice(0, -4) + 'XXXX';
			const { res } = fakeResponse({ microsoft_oauth_state: 'matching-csrf' });

			await expect(
				controller.microsoftCallback('code-abc', tampered, res as never),
			).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it('throws when school_id is tampered in the payload', async () => {
			const originalEncoded = Buffer.from(
				JSON.stringify({ csrf: 'matching-csrf', school_id: 7 }),
			).toString('base64url');
			const originalSig = createHmac('sha256', TEST_JWT_SECRET)
				.update(originalEncoded)
				.digest('base64url');

			const tamperedEncoded = Buffer.from(
				JSON.stringify({ csrf: 'matching-csrf', school_id: 999 }),
			).toString('base64url');
			const tamperedState = `${tamperedEncoded}.${originalSig}`;

			const { res } = fakeResponse({ microsoft_oauth_state: 'matching-csrf' });

			await expect(
				controller.microsoftCallback('code-abc', tamperedState, res as never),
			).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it('extracts school_id from signed state and forwards it to loginWithMicrosoftCode', async () => {
			const state = signState('matching-csrf', 7);
			const { res } = fakeResponse({ microsoft_oauth_state: 'matching-csrf' });
			authService.loginWithMicrosoftCode.mockResolvedValueOnce({
				user: { id: 1 },
				microsoft_profile: { email: 'a@b.com', name: 'A' },
				access_token: 'tok',
			});

			const result = await controller.microsoftCallback('code-abc', state, res as never);

			expect(authService.loginWithMicrosoftCode).toHaveBeenCalledWith('code-abc', 7);
			expect(res.clearCookie).toHaveBeenCalledWith('microsoft_oauth_state');
			expect(result).toMatchObject({
				code: 200,
				data: expect.objectContaining({ access_token: 'tok' }),
			});
		});
	});
});
