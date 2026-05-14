import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ActionRepository } from '../core/actions.repository';
import { ActionValidation } from '../core/actions.validation';

import { CreateActionDto, UpdateActionDto } from '../model/actions.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ActionService extends BaseService<ActionRepository> {
	constructor(
		protected readonly repository: ActionRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateActionDto, manager?: EntityManager) {
		await ActionValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateActionDto, manager?: EntityManager) {
		await ActionValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ActionValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
