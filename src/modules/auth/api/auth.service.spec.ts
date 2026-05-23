import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { UserService } from 'src/modules/organization/users/api/users.service';
import { SchoolRepository } from 'src/modules/organization/schools/core/schools.repository';
import { MailService } from 'src/modules/mail/mail.service';

describe('AuthService — MSAL login', () => {
	let service: AuthService;
	let userService: { getUser: jest.Mock; createUserLogin: jest.Mock };
	let schoolRepository: { findOneByCondition: jest.Mock };
	const configService = { get: jest.fn() } as unknown as ConfigService;
	const mailService = { sendPasswordResetEmail: jest.fn() } as unknown as MailService;

	beforeEach(() => {
		userService = {
			getUser: jest.fn(),
			createUserLogin: jest.fn(),
		};
		schoolRepository = {
			findOneByCondition: jest.fn(),
		};

		service = new AuthService(configService, userService as unknown as UserService, schoolRepository as unknown as SchoolRepository, mailService);
	});

	describe('resolveSchoolIdByCode', () => {
		it('returns the school id when the code matches an active school', async () => {
			schoolRepository.findOneByCondition.mockResolvedValueOnce({ id: 7, code: 'EISCB', is_active: true });

			await expect(service.resolveSchoolIdByCode('EISCB')).resolves.toBe(7);
			expect(schoolRepository.findOneByCondition).toHaveBeenCalledWith({
				where: { code: 'EISCB', is_active: true },
			});
		});

		it('throws HttpException(400) when no school matches', async () => {
			schoolRepository.findOneByCondition.mockResolvedValueOnce(null);

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
		it('calls createUserLogin with the user and null password', async () => {
			const fakeUser = { id: 99, email: 'jane.doe@example.com', is_admin: true };
			const acquireSpy = jest.spyOn(service as unknown as { acquireMicrosoftTokenByCode: jest.Mock }, 'acquireMicrosoftTokenByCode').mockResolvedValueOnce({
				idTokenClaims: { email: 'jane.doe@example.com', name: 'Jane Doe' },
			} as never);

			userService.getUser.mockResolvedValueOnce(fakeUser);
			userService.createUserLogin.mockResolvedValueOnce('signed-jwt-token');

			const result = await service.loginWithMicrosoftCode('auth-code', 42);

			expect(acquireSpy).toHaveBeenCalledWith('auth-code');
			expect(userService.getUser).toHaveBeenCalledWith(null, 'jane.doe@example.com');
			expect(userService.createUserLogin).toHaveBeenCalledWith(fakeUser, null);
			expect(result).toEqual({
				user: fakeUser,
				microsoft_profile: { email: 'jane.doe@example.com', name: 'Jane Doe' },
				access_token: 'signed-jwt-token',
			});
		});
	});
});
