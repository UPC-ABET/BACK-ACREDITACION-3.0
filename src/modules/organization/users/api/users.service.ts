import { Injectable, UnauthorizedException } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { UserRepository } from '../core/users.repository';
import * as bcrypt from 'bcryptjs';
import { UserValidation } from '../core/users.validation';
import { CreateUserDto, UpdateUserDto } from '../model/users.dtos';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { SchoolRepository } from 'src/modules/organization/schools/core/schools.repository';
import { AuthorizationProfile } from 'src/modules/auth/model/authorization.types';
import { UserAuthorizationService } from './user-authorization.service';

@Injectable()
export class UserService extends BaseService<UserRepository> {
	constructor(
		protected readonly repository: UserRepository,
		protected readonly dataSource: DataSource,
		private readonly jwtService: JwtService,
		private readonly schoolRepository: SchoolRepository,
		private readonly userAuthorizationService: UserAuthorizationService,
	) {
		super(repository);
	}

	async signJWTWithAuthorization(
		user: any,
		authorization: AuthorizationProfile,
		school_id: number | null = null,
	): Promise<string> {
		const payload = {
			userId: user.id,
			user: this.sanitizeUser(user),
			activeRole: authorization.activeRole,
			allowedRoles: authorization.allowedRoles,
			permissions: authorization.permissions,
			school_id,
		};

		return this.jwtService.sign(payload);
	}

	async createUserLogin(
		user: any,
		passToValidate: string | null,
		activeRoleId?: number,
		school_id: number | null = null,
	): Promise<string> {
		if (!user) {
			throw new UnauthorizedException('Credenciales invÃ¡lidas');
		}

		if (passToValidate !== null && !(await bcrypt.compare(passToValidate, user.password))) {
			throw new UnauthorizedException('Credenciales invÃ¡lidas');
		}

		const authorization = await this.getAuthorizationProfile(user.id, activeRoleId);
		return await this.signJWTWithAuthorization(user, authorization, school_id);
	}

	async getUser(user_id?: number | null, email?: string | null) {
		if (user_id) {
			return await this.baseRepository.findOneByCondition({
				where: {
					id: user_id,
					is_active: 1,
				},
			});
		}

		if (email) {
			return await this.baseRepository.findOneByCondition({
				where: {
					email,
					is_active: 1,
				},
			});
		}

		return null;
	}

	async loginById(user_id: number, activeRoleId?: number, school_id: number | null = null) {
		const user = await this.getUser(user_id);
		const accessToken = await this.createUserLogin(user, null, activeRoleId, school_id);

		return {
			user: this.sanitizeUser(user),
			access_token: accessToken,
		};
	}

	async loginByCredentials(
		school_code: string,
		email: string,
		password: string,
		activeRoleId?: number,
	) {
		const school = await this.schoolRepository.findOneByCondition({
			where: { code: school_code, is_active: true },
		});

		if (!school) {
			throw new UnauthorizedException('Credenciales inválidas');
		}

		const user = await this.repository.findForLogin(email);
		const accessToken = await this.createUserLogin(user, password, activeRoleId, school.id);

		return {
			user: this.sanitizeUser(user),
			access_token: accessToken,
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
			throw new UnauthorizedException('El usuario no tiene roles asignados');
		}

		return profile;
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
