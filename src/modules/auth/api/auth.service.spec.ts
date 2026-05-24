import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { UserService } from 'src/modules/organization/users/api/users.service';
import { SchoolService } from 'src/modules/organization/schools/api/schools.service';

describe('AuthService — MSAL login', () => {
	let service: AuthService;
	let userService: { getUser: jest.Mock; createUserLogin: jest.Mock };
	let schoolService: { findActiveByCode: jest.Mock };
	const configService = { get: jest.fn() } as unknown as ConfigService;

	beforeEach(() => {
		userService = {
			getUser: jest.fn(),
			createUserLogin: jest.fn(),
		};
		schoolService = {
			findActiveByCode: jest.fn(),
		};
		service = new AuthService(
			configService,
			userService as unknown as UserService,
			schoolService as unknown as SchoolService,
		);
	});

	describe('resolveSchoolIdByCode', () => {
		it('returns the school id when the code matches an active school', async () => {
			schoolService.findActiveByCode.mockResolvedValueOnce({
				id: 7,
				code: 'EISCB',
				is_active: true,
			});

			await expect(service.resolveSchoolIdByCode('EISCB')).resolves.toBe(7);
			expect(schoolService.findActiveByCode).toHaveBeenCalledWith('EISCB');
		});

		it('throws HttpException(400) when no school matches', async () => {
			schoolService.findActiveByCode.mockResolvedValueOnce(null);

			await expect(service.resolveSchoolIdByCode('UNKNOWN')).rejects.toMatchObject({
				constructor: HttpException,
				status: HttpStatus.BAD_REQUEST,
				response: {
					message: 'error.school.notFound',
					errors: ['error.school.notFound'],
				},
			});
		});
	});

	describe('loginWithMicrosoftCode', () => {
		it('forwards the supplied school_id through to createUserLogin', async () => {
			const fakeUser = { id: 99, email: 'jane.doe@example.com', is_admin: true };
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

			const result = await service.loginWithMicrosoftCode('auth-code', 42);

			expect(acquireSpy).toHaveBeenCalledWith('auth-code');
			expect(userService.getUser).toHaveBeenCalledWith(null, 'jane.doe@example.com');
			expect(userService.createUserLogin).toHaveBeenCalledWith(fakeUser, null, undefined, 42);
			expect(result).toEqual({
				user: fakeUser,
				microsoft_profile: { email: 'jane.doe@example.com', name: 'Jane Doe' },
				access_token: 'signed-jwt-token',
			});
		});
	});
});
