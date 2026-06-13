import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseService } from 'src/commons/base.service';
import { UserRepository } from '../core/users.repository';
import * as bcrypt from 'bcryptjs';
import { hashPassword } from 'src/libs/secure.functions';
import { UserValidation } from '../core/users.validation';
import { CreateUserDto, UpdateUserDto } from '../model/users.dtos';
import { usersValidationStrings } from '../config/strings/users.validation';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager, FindManyOptions, FindOneOptions } from 'typeorm';
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
		const { staffId, ...userData } = dto;
		const created = await super.create({ ...userData, password }, manager);
		await this.linkStaffToUser(created.id, staffId, manager);
		await this.sendWelcomeEmail(dto);
		return created;
	}

	// Tri-state: undefined leaves the link untouched, null unlinks, a value relinks (1:1, so any
	// staff previously bound to this user is released first).
	private async linkStaffToUser(
		userId: number,
		staffId: number | null | undefined,
		manager?: EntityManager,
	) {
		if (staffId === undefined) return;

		const m = manager ?? this.dataSource.manager;
		await m.query(
			`UPDATE organization.staff SET user_id = NULL, updated_at = NOW() WHERE user_id = $1`,
			[userId],
		);

		if (staffId === null) return;

		const found: Array<{ id: number }> = await m.query(
			`SELECT id FROM organization.staff WHERE id = $1 LIMIT 1`,
			[staffId],
		);
		if (found.length === 0) {
			throw new NotFoundException(usersValidationStrings.error.staffNotFound);
		}

		await m.query(`UPDATE organization.staff SET user_id = $1, updated_at = NOW() WHERE id = $2`, [
			userId,
			staffId,
		]);
	}

	// Best-effort welcome email; a mail failure (or a missing/inactive template) must never
	// fail user creation. Renders {{first_name}} / {{app_link}} on the USER_WELCOME template.
	private async sendWelcomeEmail(dto: CreateUserDto) {
		try {
			const template = await this.emailTemplateService.findByCode(USER_WELCOME_TEMPLATE_CODE);
			if (!template || template.isActive === false) {
				this.logger.warn(
					`${USER_WELCOME_TEMPLATE_CODE} email template not found or inactive; skipping welcome email for ${dto.email}`,
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
		const { staffId, ...userData } = dto;
		const updated = await super.update(id, userData, manager);
		await this.linkStaffToUser(id, staffId, manager);
		return updated;
	}

	async getAll(options?: FindManyOptions) {
		return await this.attachLinkedTeachers(await super.getAll(options));
	}

	async getById(id: number, options?: FindOneOptions) {
		const user = await super.getById(id, options);
		return user ? (await this.attachLinkedTeachers([user]))[0] : user;
	}

	async getByFilters(filters: Record<string, any>, options?: FindOneOptions) {
		return await this.attachLinkedTeachers(await super.getByFilters(filters, options));
	}

	private async attachLinkedTeachers<T>(users: T): Promise<T> {
		const list = (Array.isArray(users) ? users : []) as Array<Record<string, any>>;
		if (list.length === 0) return users;

		const rows: Array<{
			user_id: number;
			staff_id: number;
			code: string | null;
			first_name: string;
			last_name: string;
		}> = await this.dataSource.query(
			`SELECT s.user_id, s.id AS staff_id, p.code, s.first_name, s.last_name
			 FROM organization.staff s
			 LEFT JOIN academic.professors p ON p.staff_id = s.id
			 WHERE s.user_id = ANY($1)`,
			[list.map((u) => u.id)],
		);

		const byUser = new Map<number, Record<string, unknown>>();
		for (const r of rows) {
			if (!byUser.has(r.user_id)) {
				byUser.set(r.user_id, {
					staffId: r.staff_id,
					code: r.code,
					firstName: r.first_name,
					lastName: r.last_name,
				});
			}
		}

		for (const user of list) {
			const teacher = byUser.get(user.id) ?? null;
			user.staffId = teacher ? (teacher.staffId as number) : null;
			user.linkedTeacher = teacher;
		}
		return users;
	}

	async delete(id: number, manager?: EntityManager) {
		await UserValidation.validateDelete(this.repository, id);

		const run = async (m: EntityManager) => {
			await this.assertUserDeletable(id, m);
			await m.query(`DELETE FROM core.user_roles WHERE user_id = $1`, [id]);
			return await super.delete(id, m);
		};

		return manager ? run(manager) : this.dataSource.transaction(run);
	}

	private async assertUserDeletable(id: number, manager: EntityManager) {
		const [refs]: Array<{
			hasStaff: boolean;
			hasStudent: boolean;
			hasUploads: boolean;
			hasNotifications: boolean;
		}> = await manager.query(
			`SELECT
				EXISTS(SELECT 1 FROM organization.staff WHERE user_id = $1) AS "hasStaff",
				EXISTS(SELECT 1 FROM academic.students WHERE user_id = $1) AS "hasStudent",
				EXISTS(SELECT 1 FROM audit.upload_logs WHERE user_id = $1) AS "hasUploads",
				EXISTS(SELECT 1 FROM core.notification_logs WHERE notifier_user_id = $1) AS "hasNotifications"`,
			[id],
		);

		if (refs.hasStaff) {
			throw new ConflictException(usersValidationStrings.error.linkedToStaff);
		}
		if (refs.hasStudent) {
			throw new ConflictException(usersValidationStrings.error.linkedToStudent);
		}
		if (refs.hasUploads || refs.hasNotifications) {
			throw new ConflictException(usersValidationStrings.error.hasActivityHistory);
		}
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
