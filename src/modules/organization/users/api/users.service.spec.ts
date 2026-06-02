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
import { UserAuthorizationService } from './user-authorization.service';
import { JWT_EXPIRES_IN_SECONDS } from 'src/modules/auth/protocols/jwt/jwt.config';
import { OrgScopeService } from '../../org-scope/api/org-scope.service';

describe('UserService - login', () => {
	let service: UserService;
	let userRepository: { findOneByCondition: jest.Mock; findForLogin: jest.Mock };
	let jwtService: { sign: jest.Mock };
	let userAuthorizationService: { buildAuthorizationProfile: jest.Mock };
	let orgScopeService: { getUserSchools: jest.Mock };
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
		isAdmin: true,
	};

	beforeEach(() => {
		userRepository = {
			findOneByCondition: jest.fn(),
			findForLogin: jest.fn(),
		};
		jwtService = {
			sign: jest.fn().mockReturnValue('signed-jwt-token'),
		};
		userAuthorizationService = {
			buildAuthorizationProfile: jest.fn().mockResolvedValue(authorizationProfile),
		};
		orgScopeService = {
			getUserSchools: jest.fn(),
		};

		service = new UserService(
			userRepository as unknown as UserRepository,
			dataSource,
			jwtService as unknown as JwtService,
			userAuthorizationService as unknown as UserAuthorizationService,
			orgScopeService as unknown as OrgScopeService,
		);
	});

	describe('loginByCredentials', () => {
		it('throws UnauthorizedException when user does not exist', async () => {
			userRepository.findForLogin.mockResolvedValueOnce(null);

			await expect(
				service.loginByCredentials(baseUser.email, 'pw'),
			).rejects.toBeInstanceOf(UnauthorizedException);

			expect(userRepository.findForLogin).toHaveBeenCalledWith(baseUser.email);
			expect(jwtService.sign).not.toHaveBeenCalled();
		});

		it('signs a slim JWT with userId and activeRoleId', async () => {
			userRepository.findForLogin.mockResolvedValueOnce(baseUser);
			(bcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(true);

			const result = await service.loginByCredentials(baseUser.email, 'plain-password');

			expect(result).toEqual({
				user: { id: baseUser.id, email: baseUser.email, isAdmin: baseUser.isAdmin },
				accessToken: 'signed-jwt-token',
				expiresIn: JWT_EXPIRES_IN_SECONDS,
			});
			expect(result.user.password).toBeUndefined();
			expect(userAuthorizationService.buildAuthorizationProfile).toHaveBeenCalledWith(
				42,
				undefined,
			);

			const payload = jwtService.sign.mock.calls[0][0];
			expect(payload).toEqual({
				userId: baseUser.id,
				activeRoleId: authorizationProfile.activeRole.id,
			});
		});

		it('throws UnauthorizedException when password is wrong', async () => {
			userRepository.findForLogin.mockResolvedValueOnce(baseUser);
			(bcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(false);

			await expect(
				service.loginByCredentials(baseUser.email, 'wrong-password'),
			).rejects.toBeInstanceOf(UnauthorizedException);
		});
	});

	describe('signJWTWithAuthorization', () => {
		it('signs a slim payload with only userId and activeRoleId', async () => {
			const token = await service.signJWTWithAuthorization(baseUser, authorizationProfile);

			expect(token).toBe('signed-jwt-token');
			expect(jwtService.sign).toHaveBeenCalledWith({
				userId: baseUser.id,
				activeRoleId: authorizationProfile.activeRole.id,
			});
		});

		it('throws UnauthorizedException when there are no roles', async () => {
			userAuthorizationService.buildAuthorizationProfile.mockResolvedValueOnce({
				activeRole: null,
				allowedRoles: [],
				permissions: [],
			});
			await expect(service.createUserLogin(baseUser, null, undefined)).rejects.toBeInstanceOf(
				UnauthorizedException,
			);
		});

		it('throws UnauthorizedException when the role has no permissions', async () => {
			userAuthorizationService.buildAuthorizationProfile.mockResolvedValueOnce({
				activeRole: authorizationProfile.activeRole,
				allowedRoles: authorizationProfile.allowedRoles,
				permissions: [],
			});
			await expect(service.createUserLogin(baseUser, null, undefined)).rejects.toBeInstanceOf(
				UnauthorizedException,
			);
		});
	});

	describe('loginById', () => {
		it('signs a slim JWT for an existing user', async () => {
			userRepository.findOneByCondition.mockResolvedValueOnce(baseUser);

			const result = await service.loginById(baseUser.id, 2);

			expect(result).toEqual({
				user: { id: baseUser.id, email: baseUser.email, isAdmin: baseUser.isAdmin },
				accessToken: 'signed-jwt-token',
				expiresIn: JWT_EXPIRES_IN_SECONDS,
			});
			expect(result.user.password).toBeUndefined();
			expect(userAuthorizationService.buildAuthorizationProfile).toHaveBeenCalledWith(42, 2);
			expect(jwtService.sign).toHaveBeenCalledWith({
				userId: baseUser.id,
				activeRoleId: authorizationProfile.activeRole.id,
			});
		});
	});

	describe('getMe', () => {
		it('returns the current user profile with schools for the selected modality', async () => {
			const userSchools = [
				{
					id: 1,
					code: 'SCHOOL',
					name: { en: 'School' },
					facultyId: 2,
					facultyCode: 'FAC',
					facultyName: { en: 'Faculty' },
				},
			];
			userRepository.findOneByCondition.mockResolvedValueOnce(baseUser);
			orgScopeService.getUserSchools.mockResolvedValueOnce(userSchools);

			const result = await service.getMe(
				{
					userId: baseUser.id,
					activeRole: authorizationProfile.activeRole,
					allowedRoles: authorizationProfile.allowedRoles,
					permissions: authorizationProfile.permissions,
				},
				'TG102-T001',
			);

			expect(orgScopeService.getUserSchools).toHaveBeenCalledWith(baseUser.id, 'TG102-T001');
			expect(result).toEqual({
				user: { id: baseUser.id, email: baseUser.email, isAdmin: baseUser.isAdmin },
				activeRole: authorizationProfile.activeRole,
				allowedRoles: authorizationProfile.allowedRoles,
				permissions: authorizationProfile.permissions,
				userSchools,
			});
		});
	});
});
