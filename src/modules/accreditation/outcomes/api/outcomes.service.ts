import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { OutcomeRepository } from '../core/outcomes.repository';
import { OutcomeValidation } from '../core/outcomes.validation';

import { CreateOutcomeDto, UpdateOutcomeDto } from '../model/outcomes.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class OutcomeService extends BaseService<OutcomeRepository> {
	constructor(
		protected readonly repository: OutcomeRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateOutcomeDto, manager?: EntityManager) {
		await OutcomeValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateOutcomeDto, manager?: EntityManager) {
		await OutcomeValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await OutcomeValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getById(id: number) {
		return await this.repository.findByIdWithCommission(id);
	}
}
