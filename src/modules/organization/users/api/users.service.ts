import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseService } from 'src/commons/base.service';
import { UserRepository } from '../core/users.repository';
import * as bcrypt from 'bcryptjs';
import { hashPassword } from 'src/libs/secure.functions';
import { UserValidation } from '../core/users.validation';
import { CreateUserDto, UpdateUserDto } from '../model/users.dtos';
import { usersValidationStrings } from '../config/strings/users.validation';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { AuthorizationProfile } from 'src/modules/auth/model/authorization.types';
import { UserAuthorizationService } from './user-authorization.service';
import { JWT_EXPIRES_IN_SECONDS } from 'src/modules/auth/protocols/jwt/jwt.config';
import { OrgScopeService } from '../../org-scope/api/org-scope.service';
import { MailService } from 'src/modules/mail/mail.service';
import { EmailTemplateService } from 'src/modules/core/email-templates/api/email-templates.service';
import type { I18nText } from 'src/shared/types/i18n';

const USER_WELCOME_TEMPLATE_CODE = 'USER_WELCOME';

@Injectable()
export class UserService extends BaseService<UserRepository> {
	private readonly logger = new Logger(UserService.name);

	constructor(
		protected readonly repository: UserRepository,
		protected readonly dataSource: DataSource,
		private readonly jwtService: JwtService,
		private readonly userAuthorizationService: UserAuthorizationService,
		private readonly orgScopeService: OrgScopeService,
		private readonly configService: ConfigService,
		private readonly mailService: MailService,
		private readonly emailTemplateService: EmailTemplateService,
	) {
		super(repository);
	}

	async signJWTWithAuthorization(user: any, authorization: AuthorizationProfile): Promise<string> {
		const payload = {
			userId: user.id,
			activeRoleId: authorization.activeRole.id,
		};

		return this.jwtService.sign(payload);
	}

	async createUserLogin(
		user: any,
		passToValidate: string | null,
		activeRoleId: number | undefined,
	): Promise<string> {
		if (!user) {
			throw new UnauthorizedException(usersValidationStrings.error.invalidCredentials);
		}

		if (passToValidate !== null && !(await bcrypt.compare(passToValidate, user.password))) {
			throw new UnauthorizedException(usersValidationStrings.error.invalidCredentials);
		}

		const authorization = await this.getAuthorizationProfile(user.id, activeRoleId);
		return await this.signJWTWithAuthorization(user, authorization);
	}

	async getUser(userId?: number | null, email?: string | null) {
		if (userId) {
			return await this.baseRepository.findOneByCondition({
				where: {
					id: userId,
					isActive: true,
				},
			});
		}

		if (email) {
			return await this.baseRepository.findOneByCondition({
				where: {
					email,
					isActive: true,
				},
			});
		}

		return null;
	}

	async loginById(userId: number, activeRoleId: number | undefined) {
		const user = await this.getUser(userId);
		const accessToken = await this.createUserLogin(user, null, activeRoleId);

		return {
			user: this.sanitizeUser(user),
			accessToken,
			expiresIn: JWT_EXPIRES_IN_SECONDS,
		};
	}

	async loginByCredentials(email: string, password: string, activeRoleId?: number) {
		const user = await this.repository.findForLogin(email);
		const accessToken = await this.createUserLogin(user, password, activeRoleId);

		return {
			user: this.sanitizeUser(user),
			accessToken,
			expiresIn: JWT_EXPIRES_IN_SECONDS,
		};
	}

	private async getAuthorizationProfile(
		userId: number,
		activeRoleId?: number,
	): Promise<AuthorizationProfile> {
		const profile = await this.userAuthorizationService.buildAuthorizationProfile(
			userId,
			activeRoleId,
		);
		return this.validateAuthorizationProfile(profile);
	}

	private validateAuthorizationProfile(profile: AuthorizationProfile): AuthorizationProfile {
		if (
			!profile?.activeRole ||
			!Array.isArray(profile.allowedRoles) ||
			profile.allowedRoles.length === 0 ||
			!Array.isArray(profile.permissions)
		) {
			throw new UnauthorizedException(usersValidationStrings.error.noRolesAssigned);
		}

		if (profile.permissions.length === 0) {
			throw new UnauthorizedException(usersValidationStrings.error.noPermissionsAssigned);
		}

		return profile;
	}

	async getMe(
		jwtPayload: {
			userId: number;
			activeRole: any;
			allowedRoles: any[];
			permissions: any[];
		},
		modalityCode: string,
	) {
		const user = await this.getUser(jwtPayload.userId);
		if (!user) {
			throw new UnauthorizedException(usersValidationStrings.error.inactiveOrNotFound);
		}

		const isAdmin = jwtPayload.activeRole?.code?.toUpperCase() === 'ADMIN';
		const userSchools = await this.orgScopeService.getUserSchools(
			jwtPayload.userId,
			modalityCode,
			isAdmin,
		);

		return {
			user: this.sanitizeUser(user),
			activeRole: jwtPayload.activeRole,
			allowedRoles: jwtPayload.allowedRoles,
			permissions: jwtPayload.permissions,
			userSchools,
		};
	}

	private sanitizeUser(user: any) {
		if (!user) {
			return user;
		}

		const safeUser = { ...user };
		delete safeUser.password;
		return safeUser;
	}

	async create(dto: CreateUserDto, manager?: EntityManager) {
		await UserValidation.validateCreate(this.repository, dto);
		const password = await hashPassword(
			this.configService.getOrThrow<string>('DEFAULT_USER_PASSWORD'),
		);
		const created = await super.create({ ...dto, password }, manager);
		await this.sendWelcomeEmail(dto);
		return created;
	}

	// Best-effort welcome email; a mail failure (or missing template) must never fail
	// user creation. Renders {{first_name}} / {{app_link}} on the USER_WELCOME template.
	private async sendWelcomeEmail(dto: CreateUserDto) {
		try {
			const template = await this.emailTemplateService.findByCode(USER_WELCOME_TEMPLATE_CODE);
			if (!template) {
				this.logger.warn(
					`${USER_WELCOME_TEMPLATE_CODE} email template not found; skipping welcome email for ${dto.email}`,
				);
				return;
			}

			const subs: Record<string, string> = {
				'{{first_name}}': dto.firstName ?? '',
				'{{last_name}}': dto.lastName ?? '',
				'{{app_link}}': this.configService.get<string>('APP_FRONTEND_URL') ?? '',
			};

			const subject = applyTemplateSubstitutions(pickLocale(template.subject), subs);
			const html = applyTemplateSubstitutions(pickLocale(template.body), subs);

			await this.mailService.sendRawEmail({ to: dto.email, subject, html });
		} catch (error) {
			this.logger.error(
				`Welcome email failed for ${dto.email}: ${error instanceof Error ? error.message : 'unknown error'}`,
			);
		}
	}

	async update(id: number, dto: UpdateUserDto, manager?: EntityManager) {
		await UserValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await UserValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}

function pickLocale(text: I18nText | string | null | undefined, lang: 'es' | 'en' = 'es'): string {
	if (text == null) return '';
	if (typeof text === 'string') return text;
	return (text[lang] as string) ?? (text.es as string) ?? (text.en as string) ?? '';
}

function applyTemplateSubstitutions(template: string, subs: Record<string, string>): string {
	let result = template;
	for (const [key, value] of Object.entries(subs)) {
		result = result.replaceAll(key, value ?? '');
	}
	return result;
}
