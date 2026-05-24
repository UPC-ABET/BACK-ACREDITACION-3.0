import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

type AuthServiceMock = {
	resolveSchoolIdByCode: jest.Mock;
	buildMicrosoftLoginUrl: jest.Mock;
	loginWithMicrosoftCode: jest.Mock;
};

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

describe('AuthController — MSAL state packing', () => {
	let controller: AuthController;
	let authService: AuthServiceMock;

	beforeEach(() => {
		authService = {
			resolveSchoolIdByCode: jest.fn(),
			buildMicrosoftLoginUrl: jest.fn(),
			loginWithMicrosoftCode: jest.fn(),
		};
		controller = new AuthController(authService as unknown as AuthService);
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

		it('packs {csrf, school_id} into state, sets csrf cookie, and redirects', async () => {
			authService.resolveSchoolIdByCode.mockResolvedValueOnce(7);
			authService.buildMicrosoftLoginUrl.mockResolvedValueOnce(
				'https://login.microsoftonline.com/url?state=...',
			);
			const { res, cookieJar } = fakeResponse();

			await controller.loginWithMicrosoft('EISCB', res as never);

			expect(authService.resolveSchoolIdByCode).toHaveBeenCalledWith('EISCB');
			expect(authService.buildMicrosoftLoginUrl).toHaveBeenCalledTimes(1);

			const passedState = authService.buildMicrosoftLoginUrl.mock.calls[0][0];
			const parsed = JSON.parse(decodeURIComponent(passedState));
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
		function stateOf(csrf: string, school_id: number) {
			return encodeURIComponent(JSON.stringify({ csrf, school_id }));
		}

		it('throws when CSRF in state does not match the cookie', async () => {
			const state = stateOf('expected-csrf', 7);
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

		it('extracts school_id from state and forwards it to loginWithMicrosoftCode', async () => {
			const state = stateOf('matching-csrf', 7);
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
