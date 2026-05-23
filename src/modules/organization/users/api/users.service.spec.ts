import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';

jest.mock('bcryptjs', () => ({
	__esModule: true,
	compare: jest.fn(),
}));
import * as bcrypt from 'bcryptjs';

import { UserService } from './users.service';
import { UserRepository } from '../core/users.repository';
import { ROLE_CODES } from '../model/users.dtos';

describe('UserService — login', () => {
	let service: UserService;
	let userRepository: { findOneByCondition: jest.Mock; findForLogin: jest.Mock };
	let jwtService: { sign: jest.Mock };
	const dataSource = {} as DataSource;

	const baseUser = {
		id: 42,
		email: 'juan.perez@example.com',
		password: 'hashed-password',
		is_admin: true,
	};

	beforeEach(() => {
		userRepository = {
			findOneByCondition: jest.fn(),
			findForLogin: jest.fn(),
		};
		jwtService = {
			sign: jest.fn().mockReturnValue('signed-jwt-token'),
		};

		service = new UserService(userRepository as unknown as UserRepository, dataSource, jwtService as unknown as JwtService);
	});

	describe('loginByCredentials', () => {
		it('signs a JWT with user roles on successful login', async () => {
			userRepository.findForLogin.mockResolvedValueOnce(baseUser);
			(bcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(true);

			const result = await service.loginByCredentials(baseUser.email, 'plain-password');

			expect(result).toEqual({ user: baseUser, access_token: 'signed-jwt-token' });
			expect(jwtService.sign).toHaveBeenCalledTimes(1);
			const payload = jwtService.sign.mock.calls[0][0];
			expect(payload).toMatchObject({
				userId: baseUser.id,
				user: baseUser,
				activeRole: ROLE_CODES.ADMIN,
				allowedRoles: [ROLE_CODES.ADMIN],
			});
		});

		it('throws UnauthorizedException when password is wrong', async () => {
			userRepository.findForLogin.mockResolvedValueOnce(baseUser);
			(bcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(false);

			await expect(service.loginByCredentials(baseUser.email, 'wrong-password')).rejects.toBeInstanceOf(UnauthorizedException);
		});
	});

	describe('signJWTWithRoles', () => {
		it('signs a JWT with the correct payload', () => {
			const token = service.signJWTWithRoles(baseUser, ROLE_CODES.ADMIN);

			expect(token).toBe('signed-jwt-token');
			expect(jwtService.sign).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: baseUser.id,
					activeRole: ROLE_CODES.ADMIN,
					allowedRoles: [ROLE_CODES.ADMIN],
				}),
			);
		});

		it('throws UnauthorizedException when the user has no allowed roles', () => {
			expect(() => service.signJWTWithRoles({ ...baseUser, is_admin: false })).toThrow(UnauthorizedException);
		});
	});

	describe('loginById', () => {
		it('signs a JWT for an existing user', async () => {
			userRepository.findOneByCondition.mockResolvedValueOnce(baseUser);

			const result = await service.loginById(baseUser.id, ROLE_CODES.ADMIN);

			expect(result).toEqual({ user: baseUser, access_token: 'signed-jwt-token' });
			expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ activeRole: ROLE_CODES.ADMIN }));
		});
	});
});
