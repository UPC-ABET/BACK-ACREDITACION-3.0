import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { FindingOutcomeRepository } from '../core/finding-outcomes.repository';
import { FindingOutcomeValidation } from '../core/finding-outcomes.validation';

import { CreateFindingOutcomeDto, UpdateFindingOutcomeDto } from '../model/finding-outcomes.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class FindingOutcomeService extends BaseService<FindingOutcomeRepository> {
	constructor(protected readonly repository: FindingOutcomeRepository) {
		super(repository);
	}

	async create(dto: CreateFindingOutcomeDto, manager?: EntityManager) {
		await FindingOutcomeValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateFindingOutcomeDto, manager?: EntityManager) {
		await FindingOutcomeValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await FindingOutcomeValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
