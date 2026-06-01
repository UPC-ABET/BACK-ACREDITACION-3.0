import { Injectable, UnauthorizedException } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { UserRepository } from '../core/users.repository';
import * as bcrypt from 'bcryptjs';
import { UserValidation } from '../core/users.validation';
import { CreateUserDto, UpdateUserDto } from '../model/users.dtos';
import { usersValidationStrings } from '../config/strings/users.validation';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { AuthorizationProfile } from 'src/modules/auth/model/authorization.types';
import { UserAuthorizationService } from './user-authorization.service';
import { JWT_EXPIRES_IN_SECONDS } from 'src/modules/auth/protocols/jwt/jwt.config';
import { OrgScopeService } from '../../org-scope/api/org-scope.service';

@Injectable()
export class UserService extends BaseService<UserRepository> {
	constructor(
		protected readonly repository: UserRepository,
		protected readonly dataSource: DataSource,
		private readonly jwtService: JwtService,
		private readonly userAuthorizationService: UserAuthorizationService,
		private readonly orgScopeService: OrgScopeService,
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

		return profile;
	}

	async getMe(
		jwtPayload: {
			userId: number;
			activeRole: any;
			allowedRoles: any[];
			permissions: any[];
		},
	) {
		const user = await this.getUser(jwtPayload.userId);
		if (!user) {
			throw new UnauthorizedException(usersValidationStrings.error.inactiveOrNotFound);
		}

		const userSchools = await this.orgScopeService.getUserSchools(jwtPayload.userId);

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
		return await super.create(dto, manager);
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
