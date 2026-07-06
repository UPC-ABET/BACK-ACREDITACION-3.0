import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

jest.mock('bcryptjs', () => ({
	__esModule: true,
	compare: jest.fn(),
	hash: jest.fn(),
}));
import * as bcrypt from 'bcryptjs';

import { UserService } from './users.service';
import { UserRepository } from '../core/users.repository';
import { UserAuthorizationService } from './user-authorization.service';
import { JWT_EXPIRES_IN_SECONDS } from 'src/modules/auth/protocols/jwt/jwt.config';
import { OrgScopeService } from '../../org-scope/api/org-scope.service';
import { MailService } from 'src/modules/mail/mail.service';
import { EmailTemplateService } from 'src/modules/core/email-templates/api/email-templates.service';

describe('UserService - login', () => {
	let service: UserService;
	let userRepository: {
		findOneByCondition: jest.Mock;
		findForLogin: jest.Mock;
		findActiveByEmail: jest.Mock;
	};
	let passwordResetTokenRepository: {
		expirePendingTokens: jest.Mock;
		createToken: jest.Mock;
		findValidTokenWithUser: jest.Mock;
		completePasswordReset: jest.Mock;
	};
	let jwtService: { sign: jest.Mock };
	let userAuthorizationService: { buildAuthorizationProfile: jest.Mock };
	let orgScopeService: { getUserSchools: jest.Mock };
	let mailService: { sendRawEmail: jest.Mock };
	let emailTemplateService: { findByCode: jest.Mock };
	const authorizationProfile = {
		roles: [{ id: 2, name: { en: 'Coordinator', es: 'Coordinador' } }],
		permissions: [
			{ id: 6, code: 'TG2001-T002', module: 'IFCS', route: '/ifcs', permissions: ['GET', 'POST'] },
		],
	};

	const baseUser = {
		id: 42,
		email: 'juan.perez@example.com',
		password: 'hashed-password',
	};

	beforeEach(() => {
		userRepository = {
			findOneByCondition: jest.fn(),
			findForLogin: jest.fn(),
			findActiveByEmail: jest.fn(),
		};
		passwordResetTokenRepository = {
			expirePendingTokens: jest.fn().mockResolvedValue(undefined),
			createToken: jest.fn().mockResolvedValue({ id: 1 }),
			findValidTokenWithUser: jest.fn(),
			completePasswordReset: jest.fn().mockResolvedValue(undefined),
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
		const configService = {
			getOrThrow: jest.fn().mockReturnValue('ABET2020'),
			get: jest.fn().mockReturnValue('https://app.example.com'),
		};
		mailService = {
			sendRawEmail: jest.fn().mockResolvedValue({ messageId: 'msg-1' }),
		};
		emailTemplateService = {
			findByCode: jest.fn().mockResolvedValue(null),
		};

		service = new UserService(
			userRepository as unknown as UserRepository,
			passwordResetTokenRepository as any,
			jwtService as unknown as JwtService,
			userAuthorizationService as unknown as UserAuthorizationService,
			orgScopeService as unknown as OrgScopeService,
			configService as unknown as ConfigService,
			mailService as unknown as MailService,
			emailTemplateService as unknown as EmailTemplateService,
		);
	});

	describe('loginByCredentials', () => {
		it('throws UnauthorizedException when user does not exist', async () => {
			userRepository.findForLogin.mockResolvedValueOnce(null);

			await expect(service.loginByCredentials(baseUser.email, 'pw')).rejects.toBeInstanceOf(
				UnauthorizedException,
			);

			expect(userRepository.findForLogin).toHaveBeenCalledWith(baseUser.email);
			expect(jwtService.sign).not.toHaveBeenCalled();
		});

		it('signs a slim JWT with only the userId', async () => {
			userRepository.findForLogin.mockResolvedValueOnce(baseUser);
			(bcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(true);

			const result = await service.loginByCredentials(baseUser.email, 'plain-password');

			expect(result).toEqual({
				user: { id: baseUser.id, email: baseUser.email },
				accessToken: 'signed-jwt-token',
				expiresIn: JWT_EXPIRES_IN_SECONDS,
			});
			expect(result.user.password).toBeUndefined();
			expect(userAuthorizationService.buildAuthorizationProfile).toHaveBeenCalledWith(42);

			const payload = jwtService.sign.mock.calls[0][0];
			expect(payload).toEqual({ userId: baseUser.id });
		});

		it('throws UnauthorizedException when password is wrong', async () => {
			userRepository.findForLogin.mockResolvedValueOnce(baseUser);
			(bcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(false);

			await expect(
				service.loginByCredentials(baseUser.email, 'wrong-password'),
			).rejects.toBeInstanceOf(UnauthorizedException);
		});
	});

	describe('signJWT', () => {
		it('signs a slim payload with only the userId', async () => {
			const token = await service.signJWT(baseUser);

			expect(token).toBe('signed-jwt-token');
			expect(jwtService.sign).toHaveBeenCalledWith({ userId: baseUser.id });
		});

		it('throws UnauthorizedException when there are no roles', async () => {
			userAuthorizationService.buildAuthorizationProfile.mockResolvedValueOnce({
				roles: [],
				permissions: [],
			});
			await expect(service.createUserLogin(baseUser, null)).rejects.toBeInstanceOf(
				UnauthorizedException,
			);
		});

		it('throws UnauthorizedException when the roles have no permissions', async () => {
			userAuthorizationService.buildAuthorizationProfile.mockResolvedValueOnce({
				roles: authorizationProfile.roles,
				permissions: [],
			});
			await expect(service.createUserLogin(baseUser, null)).rejects.toBeInstanceOf(
				UnauthorizedException,
			);
		});
	});

	describe('getUser', () => {
		it('looks up by id via an active-scoped condition', async () => {
			userRepository.findOneByCondition.mockResolvedValueOnce(baseUser);

			const result = await service.getUser(baseUser.id);

			expect(result).toBe(baseUser);
			expect(userRepository.findOneByCondition).toHaveBeenCalledWith({
				where: { id: baseUser.id, isActive: true },
			});
			expect(userRepository.findActiveByEmail).not.toHaveBeenCalled();
		});

		it('looks up by email via the case-insensitive active lookup (Microsoft flow)', async () => {
			userRepository.findActiveByEmail.mockResolvedValueOnce(baseUser);

			const result = await service.getUser(null, 'JUAN.PEREZ@example.com');

			expect(result).toBe(baseUser);
			expect(userRepository.findActiveByEmail).toHaveBeenCalledWith('JUAN.PEREZ@example.com');
			expect(userRepository.findOneByCondition).not.toHaveBeenCalled();
		});

		it('returns null when neither id nor email is provided', async () => {
			const result = await service.getUser();

			expect(result).toBeNull();
			expect(userRepository.findActiveByEmail).not.toHaveBeenCalled();
			expect(userRepository.findOneByCondition).not.toHaveBeenCalled();
		});
	});

	describe('sendWelcomeEmail', () => {
		const newUser = {
			email: 'nuevo.usuario@example.com',
			firstName: 'Nuevo',
			lastName: 'Usuario',
		} as any;

		const activeTemplate = {
			isActive: true,
			subject: { es: 'Bienvenido {{first_name}}' },
			body: { es: 'Hola {{first_name}}, ingresa en {{app_link}}' },
		};

		it('sends the welcome email when the USER_WELCOME template is active', async () => {
			emailTemplateService.findByCode.mockResolvedValueOnce(activeTemplate);

			await (service as any).sendWelcomeEmail(newUser);

			expect(mailService.sendRawEmail).toHaveBeenCalledWith({
				to: newUser.email,
				subject: 'Bienvenido Nuevo',
				html: 'Hola Nuevo, ingresa en https://app.example.com',
			});
		});

		it('does not send the welcome email when the template is inactive', async () => {
			emailTemplateService.findByCode.mockResolvedValueOnce({ ...activeTemplate, isActive: false });

			await (service as any).sendWelcomeEmail(newUser);

			expect(mailService.sendRawEmail).not.toHaveBeenCalled();
		});

		it('does not send the welcome email when the template is missing', async () => {
			emailTemplateService.findByCode.mockResolvedValueOnce(null);

			await (service as any).sendWelcomeEmail(newUser);

			expect(mailService.sendRawEmail).not.toHaveBeenCalled();
		});
	});

	describe('requestPasswordReset', () => {
		const resetUser = {
			id: 50,
			email: 'reset.user@example.com',
			firstName: 'Reset',
			lastName: 'User',
		};

		it('creates a reset token and sends the password reset email when the user exists', async () => {
			userRepository.findActiveByEmail.mockResolvedValueOnce(resetUser);
			emailTemplateService.findByCode.mockResolvedValueOnce({
				isActive: true,
				subject: { es: 'Reset {{first_name}}' },
				body: { es: 'Open {{reset_link}} before {{expires_minutes}}' },
			});

			const result = await service.requestPasswordReset(resetUser.email);

			expect(result).toEqual({ message: 'success.user.passwordResetRequested' });
			expect(passwordResetTokenRepository.expirePendingTokens).toHaveBeenCalledWith(resetUser.id);
			expect(passwordResetTokenRepository.createToken).toHaveBeenCalledWith(
				resetUser.id,
				expect.any(String),
				expect.any(Date),
			);
			expect(mailService.sendRawEmail).toHaveBeenCalledWith({
				to: resetUser.email,
				subject: 'Reset Reset',
				html: expect.stringContaining('/auth/reset-password?token='),
			});
		});

		it('returns success without sending email when the user does not exist', async () => {
			userRepository.findActiveByEmail.mockResolvedValueOnce(null);

			const result = await service.requestPasswordReset('missing@example.com');

			expect(result).toEqual({ message: 'success.user.passwordResetRequested' });
			expect(passwordResetTokenRepository.createToken).not.toHaveBeenCalled();
			expect(mailService.sendRawEmail).not.toHaveBeenCalled();
		});
	});

	describe('resetPassword', () => {
		it('updates the password and consumes the token when the token is valid', async () => {
			passwordResetTokenRepository.findValidTokenWithUser.mockResolvedValueOnce({
				id: 9,
				userId: 50,
				email: 'reset.user@example.com',
				firstName: 'Reset',
				lastName: 'User',
			});
			(bcrypt.hash as unknown as jest.Mock).mockResolvedValueOnce('new-hashed-password');

			const result = await service.resetPassword('raw-token', 'new-password');

			expect(result).toEqual({ message: 'success.user.passwordResetCompleted' });
			expect(passwordResetTokenRepository.completePasswordReset).toHaveBeenCalledWith(
				9,
				50,
				'new-hashed-password',
			);
		});

		it('throws BadRequestException when the token is invalid', async () => {
			passwordResetTokenRepository.findValidTokenWithUser.mockResolvedValueOnce(null);

			await expect(service.resetPassword('bad-token', 'new-password')).rejects.toThrow(
				'error.user.invalidPasswordResetToken',
			);
			expect(passwordResetTokenRepository.completePasswordReset).not.toHaveBeenCalled();
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
					roles: authorizationProfile.roles,
					permissions: authorizationProfile.permissions,
				},
				'TG102-T001',
			);

			expect(orgScopeService.getUserSchools).toHaveBeenCalledWith(baseUser.id, 'TG102-T001', false);
			expect(result).toEqual({
				user: { id: baseUser.id, email: baseUser.email },
				roles: authorizationProfile.roles,
				permissions: authorizationProfile.permissions,
				userSchools,
			});
		});
	});
});
