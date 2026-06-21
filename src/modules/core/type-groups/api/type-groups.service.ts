import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { TypeGroupRepository } from '../core/type-groups.repository';
import { TypeGroupValidation } from '../core/type-groups.validation';

import { CreateTypeGroupDto, UpdateTypeGroupDto } from '../model/type-groups.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class TypeGroupService extends BaseService<TypeGroupRepository> {
	constructor(protected readonly repository: TypeGroupRepository) {
		super(repository);
	}

	async create(dto: CreateTypeGroupDto, manager?: EntityManager) {
		await TypeGroupValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateTypeGroupDto, manager?: EntityManager) {
		await TypeGroupValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await TypeGroupValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
