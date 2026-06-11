import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { UserService } from 'src/modules/organization/users/api/users.service';
import { JWT_EXPIRES_IN_SECONDS } from 'src/modules/auth/protocols/jwt/jwt.config';

describe('AuthService — MSAL login', () => {
	let service: AuthService;
	let userService: { getUser: jest.Mock; createUserLogin: jest.Mock };
	const configService = { get: jest.fn() } as unknown as ConfigService;

	beforeEach(() => {
		userService = {
			getUser: jest.fn(),
			createUserLogin: jest.fn(),
		};
		service = new AuthService(configService, userService as unknown as UserService);
	});

	describe('loginWithMicrosoftCode', () => {
		it('creates a user login from the Microsoft account email', async () => {
			const fakeUser = { id: 99, email: 'jane.doe@example.com' };
			const acquireSpy = jest
				.spyOn(
					service as unknown as { acquireMicrosoftTokenByCode: jest.Mock },
					'acquireMicrosoftTokenByCode',
				)
				.mockResolvedValueOnce({
					idTokenClaims: { email: 'jane.doe@example.com', name: 'Jane Doe' },
				} as never);

			userService.getUser.mockResolvedValueOnce(fakeUser);
			userService.createUserLogin.mockResolvedValueOnce('signed-jwt-token');

			const result = await service.loginWithMicrosoftCode('auth-code');

			expect(acquireSpy).toHaveBeenCalledWith('auth-code');
			expect(userService.getUser).toHaveBeenCalledWith(null, 'jane.doe@example.com');
			expect(userService.createUserLogin).toHaveBeenCalledWith(fakeUser, null, undefined);
			expect(result).toEqual({
				user: fakeUser,
				microsoftProfile: { email: 'jane.doe@example.com', name: 'Jane Doe' },
				accessToken: 'signed-jwt-token',
				expiresIn: JWT_EXPIRES_IN_SECONDS,
			});
		});
	});
});
