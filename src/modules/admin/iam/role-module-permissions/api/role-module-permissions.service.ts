import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { EntityManager } from 'typeorm';
import { RoleModulePermissionRepository } from '../core/role-module-permissions.repository';
import { RoleModulePermissionValidation } from '../core/role-module-permissions.validation';
import {
	CreateRoleModulePermissionDto,
	UpdateRoleModulePermissionDto,
} from '../model/role-module-permissions.dtos';

@Injectable()
export class RoleModulePermissionService extends BaseService<RoleModulePermissionRepository> {
	constructor(protected readonly repository: RoleModulePermissionRepository) {
		super(repository);
	}

	async create(dto: CreateRoleModulePermissionDto, manager?: EntityManager) {
		await RoleModulePermissionValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateRoleModulePermissionDto, manager?: EntityManager) {
		await RoleModulePermissionValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await RoleModulePermissionValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
