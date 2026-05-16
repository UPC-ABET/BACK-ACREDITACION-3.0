import { Injectable, UnauthorizedException } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { UserRepository } from '../core/users.repository';
import * as bcrypt from 'bcryptjs';
import { UserValidation } from '../core/users.validation';
import { CreateUserDto, ROLE_CODES, RoleCode, UpdateUserDto } from '../model/users.dtos';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class UserService extends BaseService<UserRepository> {
	constructor(
		protected readonly repository: UserRepository,
		protected readonly dataSource: DataSource,
		private readonly jwtService: JwtService,
	) {
		super(repository);
	}

	// %% FUNCIONES
	signJWTWithRoles(user: any, activeRole?: RoleCode): string {
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
		};

		return this.jwtService.sign(payload);
	}

	async createUserLogin(user: any, passToValidate: string | null, role?: RoleCode): Promise<string> {
		if (!user) {
			throw new UnauthorizedException('Credenciales inválidas');
		}

		if (passToValidate !== null && !(await bcrypt.compare(passToValidate, user.password))) {
			throw new UnauthorizedException('Credenciales inválidas');
		}

		return this.signJWTWithRoles(user, role);
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
	async loginById(user_id: number, role?: RoleCode) {
		const user = await this.getUser(user_id);
		const accessToken = await this.createUserLogin(user, null, role);

		return {
			user,
			access_token: accessToken,
		};
	}

	async loginByCredentials(email: string, password: string, role?: RoleCode) {
		const user = await this.repository.findForLogin(email);
		const accessToken = await this.createUserLogin(user, password, role);

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
