import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { EntityManager } from 'typeorm';
import { UserRoleRepository } from '../core/user-roles.repository';
import { UserRoleValidation } from '../core/user-roles.validation';
import { CreateUserRoleDto, UpdateUserRoleDto } from '../model/user-roles.dtos';

@Injectable()
export class UserRoleService extends BaseService<UserRoleRepository> {
	constructor(protected readonly repository: UserRoleRepository) {
		super(repository);
	}

	async create(dto: CreateUserRoleDto, manager?: EntityManager) {
		await UserRoleValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateUserRoleDto, manager?: EntityManager) {
		await UserRoleValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await UserRoleValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
