import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
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
import { ROLE_CODES } from '../model/users.dtos';
import { usersValidationStrings } from '../config/strings/users.validation';

describe('UserService — school-aware login', () => {
	let service: UserService;
	let userRepository: { findOneByCondition: jest.Mock; findActiveByEmailWithPassword: jest.Mock };
	let schoolRepository: { findOneByCondition: jest.Mock };
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
			findActiveByEmailWithPassword: jest.fn(),
		};
		schoolRepository = {
			findOneByCondition: jest.fn(),
		};
		jwtService = {
			sign: jest.fn().mockReturnValue('signed-jwt-token'),
		};

		service = new UserService(userRepository as unknown as UserRepository, dataSource, jwtService as unknown as JwtService, schoolRepository as unknown as SchoolRepository);
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
			expect(userRepository.findActiveByEmailWithPassword).not.toHaveBeenCalled();
			expect(jwtService.sign).not.toHaveBeenCalled();
		});

		it('resolves the school and signs a JWT carrying school.id as school_id', async () => {
			schoolRepository.findOneByCondition.mockResolvedValueOnce({ id: 7, code: 'EISCB', is_active: true });
			userRepository.findActiveByEmailWithPassword.mockResolvedValueOnce(baseUser);
			(bcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(true);

			const result = await service.loginByCredentials('EISCB', baseUser.email, 'plain-password');

			expect(result).toEqual({ user: baseUser, access_token: 'signed-jwt-token' });
			expect(jwtService.sign).toHaveBeenCalledTimes(1);
			const payload = jwtService.sign.mock.calls[0][0];
			expect(payload).toMatchObject({
				userId: baseUser.id,
				user: baseUser,
				activeRole: ROLE_CODES.ADMIN,
				allowedRoles: [ROLE_CODES.ADMIN],
				school_id: 7,
			});
		});
	});

	describe('signJWTWithRoles', () => {
		it('includes the supplied school_id in the signed payload', async () => {
			const token = await service.signJWTWithRoles(baseUser, ROLE_CODES.ADMIN, 13);

			expect(token).toBe('signed-jwt-token');
			expect(jwtService.sign).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: baseUser.id,
					activeRole: ROLE_CODES.ADMIN,
					allowedRoles: [ROLE_CODES.ADMIN],
					school_id: 13,
				}),
			);
		});

		it('defaults school_id to null when none is provided', async () => {
			await service.signJWTWithRoles(baseUser);

			expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ school_id: null }));
		});

		it('throws UnauthorizedException when the user has no allowed roles', async () => {
			await expect(service.signJWTWithRoles({ ...baseUser, is_admin: false })).rejects.toBeInstanceOf(UnauthorizedException);
		});
	});

	describe('loginById', () => {
		it('preserves the supplied school_id when re-signing (changeRole flow)', async () => {
			userRepository.findOneByCondition.mockResolvedValueOnce(baseUser);

			const result = await service.loginById(baseUser.id, ROLE_CODES.ADMIN, 99);

			expect(result).toEqual({ user: baseUser, access_token: 'signed-jwt-token' });
			expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ school_id: 99, activeRole: ROLE_CODES.ADMIN }));
		});
	});
});
