import { Injectable, UnauthorizedException } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { UserRepository } from '../core/users.repository';
import * as bcrypt from 'bcryptjs';
import { UserValidation } from '../core/users.validation';
import { CreateUserDto, UpdateUserDto } from '../model/users.dtos';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { SchoolService } from 'src/modules/organization/schools/api/schools.service';
import { AuthorizationProfile } from 'src/modules/auth/model/authorization.types';
import { UserAuthorizationService } from './user-authorization.service';
import { JWT_EXPIRES_IN_SECONDS } from 'src/modules/auth/protocols/jwt/jwt.config';

@Injectable()
export class UserService extends BaseService<UserRepository> {
	constructor(
		protected readonly repository: UserRepository,
		protected readonly dataSource: DataSource,
		private readonly jwtService: JwtService,
		private readonly schoolService: SchoolService,
		private readonly userAuthorizationService: UserAuthorizationService,
	) {
		super(repository);
	}

	async signJWTWithAuthorization(
		user: any,
		authorization: AuthorizationProfile,
		school_id: number,
	): Promise<string> {
		const payload = {
			userId: user.id,
			activeRoleId: authorization.activeRole.id,
			school_id,
		};

		return this.jwtService.sign(payload);
	}

	async createUserLogin(
		user: any,
		passToValidate: string | null,
		activeRoleId: number | undefined,
		school_id: number,
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
					is_active: true,
				},
			});
		}

		if (email) {
			return await this.baseRepository.findOneByCondition({
				where: {
					email,
					is_active: true,
				},
			});
		}

		return null;
	}

	async loginById(user_id: number, activeRoleId: number | undefined, school_id: number) {
		const user = await this.getUser(user_id);
		const accessToken = await this.createUserLogin(user, null, activeRoleId, school_id);

		return {
			user: this.sanitizeUser(user),
			access_token: accessToken,
			expires_in: JWT_EXPIRES_IN_SECONDS,
		};
	}

	async loginByCredentials(
		school_code: string,
		email: string,
		password: string,
		activeRoleId?: number,
	) {
		const school = await this.schoolService.findActiveByCode(school_code);

		if (!school) {
			throw new UnauthorizedException('Credenciales inválidas');
		}

		const user = await this.repository.findForLogin(email);
		const accessToken = await this.createUserLogin(user, password, activeRoleId, school.id);

		return {
			user: this.sanitizeUser(user),
			access_token: accessToken,
			expires_in: JWT_EXPIRES_IN_SECONDS,
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
