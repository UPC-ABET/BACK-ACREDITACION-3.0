import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseService } from 'src/commons/base.service';
import { UserRepository } from '../core/users.repository';
import * as bcrypt from 'bcryptjs';
import axios from 'axios';
import { UserValidation } from '../core/users.validation';
import { CreateUserDto, UpdateUserDto } from '../model/users.dtos';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { SchoolRepository } from 'src/modules/organization/schools/core/schools.repository';
import { usersValidationStrings } from '../config/strings/users.validation';
import { AuthorizationProfile } from 'src/modules/auth/model/authorization.types';

@Injectable()
export class UserService extends BaseService<UserRepository> {
	constructor(
		protected readonly repository: UserRepository,
		protected readonly dataSource: DataSource,
		private readonly jwtService: JwtService,
		private readonly schoolRepository: SchoolRepository,
		private readonly configService: ConfigService,
	) {
		super(repository);
	}

	// %% FUNCIONES
	async signJWTWithAuthorization(user: any, authorization: AuthorizationProfile, school_id: number | null = null): Promise<string> {
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

	async createUserLogin(user: any, passToValidate: string | null, activeRoleId?: number, school_id: number | null = null): Promise<string> {
		if (!user) {
			throw new UnauthorizedException('Credenciales inválidas');
		}

		if (passToValidate !== null && !(await bcrypt.compare(passToValidate, user.password))) {
			throw new UnauthorizedException('Credenciales inválidas');
		}

		const provisionalToken = this.signProvisionalJWT(user, school_id);
		const authorization = await this.getAuthorizationProfile(user.id, provisionalToken, activeRoleId);

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

	// %% SERVICIOS PROPIOS
	async loginById(user_id: number, activeRoleId?: number, school_id: number | null = null) {
		const user = await this.getUser(user_id);
		const accessToken = await this.createUserLogin(user, null, activeRoleId, school_id);

		return {
			user,
			access_token: accessToken,
		};
	}

	async loginByCredentials(school_code: string, email: string, password: string, activeRoleId?: number) {
		const school = await this.schoolRepository.findOneByCondition({
			where: { code: school_code, is_active: true },
		});

		if (!school) {
			throw new HttpException(
				{
					message: usersValidationStrings.error.schoolNotFound,
					errors: [usersValidationStrings.error.schoolNotFound],
				},
				HttpStatus.BAD_REQUEST,
			);
		}

		const user = await this.repository.findForLogin(email);
		const accessToken = await this.createUserLogin(user, password, activeRoleId, school.id);

		return {
			user,
			access_token: accessToken,
		};
	}

	private signProvisionalJWT(user: any, school_id: number | null) {
		return this.jwtService.sign({
			userId: user.id,
			user: this.sanitizeUser(user),
			school_id,
			token_use: 'authorization_lookup',
		});
	}

	private async getAuthorizationProfile(userId: number, token: string, activeRoleId?: number): Promise<AuthorizationProfile> {
		const url = this.buildAuthorizationUrl(userId, activeRoleId);

		try {
			const response = await axios.get<AuthorizationProfile>(url, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			return this.validateAuthorizationProfile(response.data);
		} catch (error) {
			if (axios.isAxiosError(error) && error.response?.status === 401) {
				throw new UnauthorizedException('No se pudo validar los permisos del usuario');
			}

			throw new UnauthorizedException('No se pudo obtener roles y permisos del usuario');
		}
	}

	private buildAuthorizationUrl(userId: number, activeRoleId?: number) {
		const baseUrl = this.configService.get<string>('AUTHORIZATION_MIDDLEWARE_BASE_URL');
		const route = this.configService.get<string>('AUTHORIZATION_MIDDLEWARE_ROLES_PATH');

		if (!baseUrl || !route) {
			throw new UnauthorizedException('Falta configurar el middleware de autorización');
		}

		let hasUserPlaceholder = false;
		let path = route.replace(/:userId|{userId}|:id|{id}/g, () => {
			hasUserPlaceholder = true;
			return String(userId);
		});

		path = path.replace(/^\/+/, '');

		const url = new URL(path, `${baseUrl.replace(/\/+$/, '')}/`);

		if (!hasUserPlaceholder) {
			url.searchParams.set('user_id', String(userId));
		}

		if (activeRoleId) {
			url.searchParams.set('active_role_id', String(activeRoleId));
		}

		return url.toString();
	}

	private validateAuthorizationProfile(profile: AuthorizationProfile): AuthorizationProfile {
		if (!profile?.activeRole || !Array.isArray(profile.allowedRoles) || profile.allowedRoles.length === 0 || !Array.isArray(profile.permissions)) {
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

	async savePasswordResetToken(user: any, tokenHash: string, expiresAt: string) {
		await this.baseRepository.update(user.id, { password_reset_token: tokenHash, password_reset_expires_at: expiresAt });
	}

	async resetPasswordWithToken(user: any, tokenHash: string, newPassword: string) {
		if (!user) throw new UnauthorizedException('Usuario no encontrado');
		if (!user.password_reset_token || user.password_reset_token !== tokenHash) throw new UnauthorizedException('Token inválido');
		if (!user.password_reset_expires_at || new Date(user.password_reset_expires_at) < new Date()) throw new UnauthorizedException('El token ha expirado');
		const hashedPassword = await bcrypt.hash(newPassword, 10);
		await this.baseRepository.update(user.id, { password: hashedPassword, password_reset_token: null, password_reset_expires_at: null });
	}

	// %% SERVICIOS HEREDADOS
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
