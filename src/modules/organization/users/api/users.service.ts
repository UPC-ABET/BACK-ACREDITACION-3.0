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
import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from '../model/users.dtos';
import { UserEntity } from '../model/users.entity';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';
import { usersValidationStrings } from '../config/strings/users.validation';
import { JwtService } from '@nestjs/jwt';
import { EntityManager, FindOneOptions } from 'typeorm';
import { AuthorizationProfile } from 'src/modules/auth/model/authorization.types';
import { UserAuthorizationService } from './user-authorization.service';
import { JWT_EXPIRES_IN_SECONDS } from 'src/modules/auth/protocols/jwt/jwt.config';
import { OrgScopeService } from '../../org-scope/api/org-scope.service';
import { MailService } from 'src/modules/mail/mail.service';
import { EmailTemplateService } from 'src/modules/core/email-templates/api/email-templates.service';
import type { I18nText } from 'src/shared/types/i18n';
import { isAdmin } from 'src/modules/auth/model/authorization.functions';
import type { RequestUser } from 'src/modules/auth/model/authorization.types';

const USER_WELCOME_TEMPLATE_CODE = 'USER_WELCOME';

@Injectable()
export class UserService extends BaseService<UserRepository> {
	private readonly logger = new Logger(UserService.name);

	constructor(
		protected readonly repository: UserRepository,
		private readonly jwtService: JwtService,
		private readonly userAuthorizationService: UserAuthorizationService,
		private readonly orgScopeService: OrgScopeService,
		private readonly configService: ConfigService,
		private readonly mailService: MailService,
		private readonly emailTemplateService: EmailTemplateService,
	) {
		super(repository);
	}

	async signJWT(user: any): Promise<string> {
		return this.jwtService.sign({ userId: user.id });
	}

	async createUserLogin(user: any, passToValidate: string | null): Promise<string> {
		if (!user) {
			throw new UnauthorizedException(usersValidationStrings.error.invalidCredentials);
		}

		if (passToValidate !== null && !(await bcrypt.compare(passToValidate, user.password))) {
			throw new UnauthorizedException(usersValidationStrings.error.invalidCredentials);
		}

		await this.getAuthorizationProfile(user.id);
		return await this.signJWT(user);
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
			return await this.repository.findActiveByEmail(email);
		}

		return null;
	}

	async loginByCredentials(email: string, password: string) {
		const user = await this.repository.findForLogin(email);
		const accessToken = await this.createUserLogin(user, password);

		return {
			user: this.sanitizeUser(user),
			accessToken,
			expiresIn: JWT_EXPIRES_IN_SECONDS,
		};
	}

	private async getAuthorizationProfile(userId: number): Promise<AuthorizationProfile> {
		const profile = await this.userAuthorizationService.buildAuthorizationProfile(userId);
		return this.validateAuthorizationProfile(profile);
	}

	private validateAuthorizationProfile(profile: AuthorizationProfile): AuthorizationProfile {
		if (
			!Array.isArray(profile?.roles) ||
			profile.roles.length === 0 ||
			!Array.isArray(profile.permissions)
		) {
			throw new UnauthorizedException(usersValidationStrings.error.noRolesAssigned);
		}

		if (profile.permissions.length === 0) {
			throw new UnauthorizedException(usersValidationStrings.error.noPermissionsAssigned);
		}

		return profile;
	}

	async getMe(currentUser: RequestUser, modalityCode: string) {
		const user = await this.getUser(currentUser.userId);
		if (!user) {
			throw new UnauthorizedException(usersValidationStrings.error.inactiveOrNotFound);
		}

		const userSchools = await this.orgScopeService.getUserSchools(
			currentUser.userId,
			modalityCode,
			isAdmin(currentUser),
		);

		return {
			user: this.sanitizeUser(user),
			roles: currentUser.roles,
			permissions: currentUser.permissions,
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

		await this.repository.releaseStaffFromUser(userId, manager);

		if (staffId === null) return;

		const found = await this.repository.findStaffId(staffId, manager);
		if (found === null) {
			throw new NotFoundException(usersValidationStrings.error.staffNotFound);
		}

		await this.repository.linkStaffToUser(userId, staffId, manager);
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

	async getMaintenanceList(query: ListUsersQueryDto): Promise<PaginatedResult<UserEntity>> {
		const { page, pageSize, skip, take } = resolvePagination(query);
		const [users, total] = await this.repository.findMaintenancePage(
			query.search,
			query.unlinkedOnly === true,
			skip,
			take,
		);

		const items = await this.attachLinkedTeachers(users);
		return toPaginated(items, total, page, pageSize);
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

		const rows = await this.repository.findLinkedTeachers(list.map((u) => u.id));

		const byUser = new Map<number, Record<string, unknown>>();
		for (const r of rows) {
			if (!byUser.has(r.userId)) {
				byUser.set(r.userId, {
					id: r.staffId,
					code: r.code,
					firstName: r.firstName,
					lastName: r.lastName,
				});
			}
		}

		for (const user of list) {
			user.staff = byUser.get(user.id) ?? null;
		}
		return users;
	}

	async delete(id: number, manager?: EntityManager) {
		await UserValidation.validateDelete(this.repository, id);

		const run = async (m: EntityManager) => {
			await this.assertUserDeletable(id, m);
			await this.repository.deleteUserRoles(id, m);
			return await super.delete(id, m);
		};

		return manager ? run(manager) : this.repository.runInTransaction(run);
	}

	private async assertUserDeletable(id: number, manager: EntityManager) {
		const refs = await this.repository.findDeleteBlockerRefs(id, manager);

		if (refs.hasStaff) {
			throw new ConflictException(usersValidationStrings.error.linkedToStaff);
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
