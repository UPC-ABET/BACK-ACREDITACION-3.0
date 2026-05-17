import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { UserRepository } from '../core/users.repository';
import * as bcrypt from 'bcryptjs';
import { UserValidation } from '../core/users.validation';
import { CreateUserDto, ROLE_CODES, RoleCode, UpdateUserDto } from '../model/users.dtos';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { SchoolRepository } from 'src/modules/organization/schools/core/schools.repository';
import { usersValidationStrings } from '../config/strings/users.validation';

@Injectable()
export class UserService extends BaseService<UserRepository> {
	constructor(
		protected readonly repository: UserRepository,
		protected readonly dataSource: DataSource,
		private readonly jwtService: JwtService,
		private readonly schoolRepository: SchoolRepository,
	) {
		super(repository);
	}

	// %% FUNCIONES
	async signJWTWithRoles(user: any, activeRole?: RoleCode, school_id: number | null = null): Promise<string> {
		const allowedRoles: RoleCode[] = [];

		if (user?.is_admin) {
			allowedRoles.push(ROLE_CODES.ADMIN);
		}

		/*
			Por ahora NO se valida PROFESSOR porque UserEntity
			no tiene relación con person ni professor.
		*/

		if (allowedRoles.length === 0) {
			throw new UnauthorizedException('El usuario no tiene roles asignados');
		}

		if (!activeRole || !allowedRoles.includes(activeRole)) {
			activeRole = allowedRoles[0];
		}

		const payload = {
			userId: user.id,
			user,
			activeRole,
			allowedRoles,
			school_id,
		};

		return this.jwtService.sign(payload);
	}

	async createUserLogin(user: any, passToValidate: string | null, role?: RoleCode, school_id: number | null = null): Promise<string> {
		if (!user) {
			throw new UnauthorizedException('Credenciales inválidas');
		}

		if (passToValidate !== null && !(await bcrypt.compare(passToValidate, user.password))) {
			throw new UnauthorizedException('Credenciales inválidas');
		}

		return await this.signJWTWithRoles(user, role, school_id);
	}

	async getUser(user_id?: number | null, email?: string | null, includePassword = false) {
		if (user_id) {
			return await this.baseRepository.findOneByCondition({
				where: {
					id: user_id,
					is_active: true,
				},
			});
		}

		if (email) {
			if (includePassword) {
				return await this.repository.findActiveByEmailWithPassword(email);
			}

			return await this.baseRepository.findOneByCondition({
				where: {
					email,
					is_active: true,
				},
			});
		}

		return null;
	}

	// %% SERVICIOS PROPIOS
	async loginById(user_id: number, role?: RoleCode, school_id: number | null = null) {
		const user = await this.getUser(user_id);
		const accessToken = await this.createUserLogin(user, null, role, school_id);

		return {
			user,
			access_token: accessToken,
		};
	}

	async loginByCredentials(school_code: string, email: string, password: string, role?: RoleCode) {
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

		const user = await this.getUser(null, email, true);
		const accessToken = await this.createUserLogin(user, password, role, school.id);

		return {
			user,
			access_token: accessToken,
		};
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
