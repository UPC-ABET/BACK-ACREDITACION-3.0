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
import { SchoolRepository } from 'src/modules/organization/schools/core/schools.repository';
import { UserAuthorizationService } from './user-authorization.service';

describe('UserService - school-aware login', () => {
	let service: UserService;
	let userRepository: { findOneByCondition: jest.Mock; findForLogin: jest.Mock };
	let schoolRepository: { findOneByCondition: jest.Mock };
	let jwtService: { sign: jest.Mock };
	let userAuthorizationService: { buildAuthorizationProfile: jest.Mock };
	const dataSource = {} as DataSource;
	const authorizationProfile = {
		activeRole: { id: 2, name: { en: 'Coordinator', es: 'Coordinador' } },
		allowedRoles: [{ id: 2, name: { en: 'Coordinator', es: 'Coordinador' } }],
		permissions: [
			{ id: 6, code: 'TG2001-T002', module: 'IFCS', route: '/ifcs', permissions: ['GET', 'POST'] },
		],
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
			sign: jest.fn().mockReturnValue('signed-jwt-token'),
		};
		userAuthorizationService = {
			buildAuthorizationProfile: jest.fn().mockResolvedValue(authorizationProfile),
		};

		service = new UserService(
			userRepository as unknown as UserRepository,
			dataSource,
			jwtService as unknown as JwtService,
			schoolRepository as unknown as SchoolRepository,
			userAuthorizationService as unknown as UserAuthorizationService,
		);
	});

	describe('loginByCredentials', () => {
		it('throws UnauthorizedException when the school_code does not match any school', async () => {
			schoolRepository.findOneByCondition.mockResolvedValueOnce(null);

			await expect(
				service.loginByCredentials('UNKNOWN', baseUser.email, 'pw'),
			).rejects.toBeInstanceOf(UnauthorizedException);

			expect(schoolRepository.findOneByCondition).toHaveBeenCalledWith({
				where: { code: 'UNKNOWN', is_active: true },
			});
			expect(userRepository.findForLogin).not.toHaveBeenCalled();
			expect(jwtService.sign).not.toHaveBeenCalled();
		});

		it('resolves school and signs a JWT carrying local roles, permissions and school.id', async () => {
			schoolRepository.findOneByCondition.mockResolvedValueOnce({
				id: 7,
				code: 'EISCB',
				is_active: true,
			});
			userRepository.findForLogin.mockResolvedValueOnce(baseUser);
			(bcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(true);

			const result = await service.loginByCredentials('EISCB', baseUser.email, 'plain-password');

			expect(result).toEqual({
				user: { id: baseUser.id, email: baseUser.email, is_admin: baseUser.is_admin },
				access_token: 'signed-jwt-token',
			});
			expect(result.user.password).toBeUndefined();
			expect(userAuthorizationService.buildAuthorizationProfile).toHaveBeenCalledWith(
				42,
				undefined,
			);

			const payload = jwtService.sign.mock.calls[0][0];
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
			schoolRepository.findOneByCondition.mockResolvedValueOnce({
				id: 7,
				code: 'EISCB',
				is_active: true,
			});
			userRepository.findForLogin.mockResolvedValueOnce(baseUser);
			(bcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(false);

			await expect(
				service.loginByCredentials('EISCB', baseUser.email, 'wrong-password'),
			).rejects.toBeInstanceOf(UnauthorizedException);
		});
	});

	describe('signJWTWithAuthorization', () => {
		it('includes the supplied school_id in the signed payload', async () => {
			const token = await service.signJWTWithAuthorization(baseUser, authorizationProfile, 13);

			expect(token).toBe('signed-jwt-token');
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

		it('throws UnauthorizedException when there are no roles', async () => {
			userAuthorizationService.buildAuthorizationProfile.mockResolvedValueOnce({
				activeRole: null,
				allowedRoles: [],
				permissions: [],
			});
			await expect(service.createUserLogin(baseUser, null)).rejects.toBeInstanceOf(
				UnauthorizedException,
			);
		});
	});

	describe('loginById', () => {
		it('signs a JWT for an existing user', async () => {
			userRepository.findOneByCondition.mockResolvedValueOnce(baseUser);

			const result = await service.loginById(baseUser.id, 2, 99);

			expect(result).toEqual({
				user: { id: baseUser.id, email: baseUser.email, is_admin: baseUser.is_admin },
				access_token: 'signed-jwt-token',
			});
			expect(result.user.password).toBeUndefined();
			expect(userAuthorizationService.buildAuthorizationProfile).toHaveBeenCalledWith(42, 2);
			expect(jwtService.sign).toHaveBeenCalledWith(
				expect.objectContaining({ school_id: 99, activeRole: authorizationProfile.activeRole }),
			);
		});
	});
});
