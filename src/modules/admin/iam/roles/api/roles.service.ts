import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { EntityManager } from 'typeorm';
import { RoleRepository } from '../core/roles.repository';
import { RoleValidation } from '../core/roles.validation';
import { CreateRoleDto, UpdateRoleDto } from '../model/roles.dtos';

@Injectable()
export class RoleService extends BaseService<RoleRepository> {
	constructor(protected readonly repository: RoleRepository) {
		super(repository);
	}

	async create(dto: CreateRoleDto, manager?: EntityManager) {
		await RoleValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateRoleDto, manager?: EntityManager) {
		await RoleValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await RoleValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
