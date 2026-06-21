import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { FindingActionRepository } from '../core/finding-actions.repository';
import { FindingActionValidation } from '../core/finding-actions.validation';

import { CreateFindingActionDto, UpdateFindingActionDto } from '../model/finding-actions.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class FindingActionService extends BaseService<FindingActionRepository> {
	constructor(protected readonly repository: FindingActionRepository) {
		super(repository);
	}

	async create(dto: CreateFindingActionDto, manager?: EntityManager) {
		await FindingActionValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateFindingActionDto, manager?: EntityManager) {
		await FindingActionValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await FindingActionValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
