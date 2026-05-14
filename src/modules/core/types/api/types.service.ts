import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { TypeRepository } from '../core/types.repository';
import { TypeValidation } from '../core/types.validation';

import { CreateTypeDto, UpdateTypeDto } from '../model/types.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class TypeService extends BaseService<TypeRepository> {
	constructor(
		protected readonly repository: TypeRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateTypeDto, manager?: EntityManager) {
		await TypeValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateTypeDto, manager?: EntityManager) {
		await TypeValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await TypeValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
