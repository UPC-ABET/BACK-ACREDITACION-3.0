import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { FindingRepository } from '../core/findings.repository';
import { FindingValidation } from '../core/findings.validation';

import { CreateFindingDto, UpdateFindingDto } from '../model/findings.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class FindingService extends BaseService<FindingRepository> {
	constructor(protected readonly repository: FindingRepository) {
		super(repository);
	}

	async create(dto: CreateFindingDto, manager?: EntityManager) {
		await FindingValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateFindingDto, manager?: EntityManager) {
		await FindingValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await FindingValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
