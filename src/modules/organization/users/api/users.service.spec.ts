import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import axios from 'axios';

jest.mock('bcryptjs', () => ({
	__esModule: true,
	compare: jest.fn(),
}));
import * as bcrypt from 'bcryptjs';

import { UserService } from './users.service';
import { UserRepository } from '../core/users.repository';
import { SchoolRepository } from 'src/modules/organization/schools/core/schools.repository';
import { usersValidationStrings } from '../config/strings/users.validation';

jest.mock('axios');

describe('UserService — school-aware login', () => {
	let service: UserService;
	let userRepository: { findOneByCondition: jest.Mock; findForLogin: jest.Mock };
	let schoolRepository: { findOneByCondition: jest.Mock };
	let jwtService: { sign: jest.Mock };
	let configService: { get: jest.Mock };
	const dataSource = {} as DataSource;
	const authorizationProfile = {
		activeRole: { id: 2, name: { en: 'Coordinator', es: 'Coordinador' } },
		allowedRoles: [{ id: 2, name: { en: 'Coordinator', es: 'Coordinador' } }],
		permissions: [{ id: 6, code: 'TG2001-T002', module: 'IFCS', route: '/ifcs', permissions: ['GET', 'POST'] }],
	};

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
		schoolRepository = {
			findOneByCondition: jest.fn(),
		};
		jwtService = {
			sign: jest.fn().mockReturnValueOnce('provisional-jwt-token').mockReturnValue('signed-jwt-token'),
		};
		configService = {
			get: jest.fn((key: string) => {
				const values = {
					AUTHORIZATION_MIDDLEWARE_BASE_URL: 'http://localhost:8888',
					AUTHORIZATION_MIDDLEWARE_ROLES_PATH: '/authorization/users/:userId',
				};
				return values[key];
			}),
		};
		(axios.get as jest.Mock).mockResolvedValue({ data: authorizationProfile });

		service = new UserService(
			userRepository as unknown as UserRepository,
			dataSource,
			jwtService as unknown as JwtService,
			schoolRepository as unknown as SchoolRepository,
			configService as unknown as ConfigService,
		);
	});

	describe('loginByCredentials', () => {
		it('throws HttpException(400) when the school_code does not match any school', async () => {
			schoolRepository.findOneByCondition.mockResolvedValueOnce(null);

			await expect(service.loginByCredentials('UNKNOWN', baseUser.email, 'pw')).rejects.toMatchObject({
				constructor: HttpException,
				status: HttpStatus.BAD_REQUEST,
				response: {
					message: usersValidationStrings.error.schoolNotFound,
					errors: [usersValidationStrings.error.schoolNotFound],
				},
			});

			expect(schoolRepository.findOneByCondition).toHaveBeenCalledWith({
				where: { code: 'UNKNOWN', is_active: true },
			});
			expect(userRepository.findForLogin).not.toHaveBeenCalled();
			expect(jwtService.sign).not.toHaveBeenCalled();
		});

		it('resolves the school and signs a JWT carrying middleware roles, permissions and school.id', async () => {
			schoolRepository.findOneByCondition.mockResolvedValueOnce({ id: 7, code: 'EISCB', is_active: true });
			userRepository.findForLogin.mockResolvedValueOnce(baseUser);
			(bcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(true);

			const result = await service.loginByCredentials('EISCB', baseUser.email, 'plain-password');

			expect(result).toEqual({ user: baseUser, access_token: 'signed-jwt-token' });
			expect(jwtService.sign).toHaveBeenCalledTimes(2);
			expect(axios.get).toHaveBeenCalledWith('http://localhost:8888/authorization/users/42', {
				headers: {
					Authorization: 'Bearer provisional-jwt-token',
				},
			});
			const payload = jwtService.sign.mock.calls[1][0];
			expect(payload).toMatchObject({
				userId: baseUser.id,
				user: { id: baseUser.id, email: baseUser.email, is_admin: true },
				activeRole: authorizationProfile.activeRole,
				allowedRoles: authorizationProfile.allowedRoles,
				permissions: authorizationProfile.permissions,
				school_id: 7,
			});
			expect(payload.user.password).toBeUndefined();
		});

		it('throws UnauthorizedException when password is wrong', async () => {
			schoolRepository.findOneByCondition.mockResolvedValueOnce({ id: 7, code: 'EISCB', is_active: true });
			userRepository.findForLogin.mockResolvedValueOnce(baseUser);
			(bcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(false);

			await expect(service.loginByCredentials('EISCB', baseUser.email, 'wrong-password')).rejects.toBeInstanceOf(UnauthorizedException);
		});
	});

	describe('signJWTWithAuthorization', () => {
		it('includes the supplied school_id in the signed payload', async () => {
			const token = await service.signJWTWithAuthorization(baseUser, authorizationProfile, 13);

			expect(token).toBe('provisional-jwt-token');
			expect(jwtService.sign).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: baseUser.id,
					activeRole: authorizationProfile.activeRole,
					allowedRoles: authorizationProfile.allowedRoles,
					permissions: authorizationProfile.permissions,
					school_id: 13,
				}),
			);
		});

		it('defaults school_id to null when none is provided', async () => {
			await service.signJWTWithAuthorization(baseUser, authorizationProfile);

			expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ school_id: null }));
		});

		it('throws UnauthorizedException when the middleware does not return roles', async () => {
			(axios.get as jest.Mock).mockResolvedValueOnce({ data: { activeRole: null, allowedRoles: [], permissions: [] } });

			await expect(service.createUserLogin(baseUser, null)).rejects.toBeInstanceOf(UnauthorizedException);
		});
	});

	describe('loginById', () => {
		it('signs a JWT for an existing user', async () => {
			userRepository.findOneByCondition.mockResolvedValueOnce(baseUser);

			const result = await service.loginById(baseUser.id, 2, 99);

			expect(result).toEqual({ user: baseUser, access_token: 'signed-jwt-token' });
			expect(axios.get).toHaveBeenCalledWith('http://localhost:8888/authorization/users/42?active_role_id=2', expect.any(Object));
			expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ school_id: 99, activeRole: authorizationProfile.activeRole }));
		});
	});
});
