import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { OutcomeConfigRepository } from '../core/outcome-configs.repository';
import { OutcomeConfigValidation } from '../core/outcome-configs.validation';

import { CreateOutcomeConfigDto, UpdateOutcomeConfigDto } from '../model/outcome-configs.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class OutcomeConfigService extends BaseService<OutcomeConfigRepository> {
	constructor(
		protected readonly repository: OutcomeConfigRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateOutcomeConfigDto, manager?: EntityManager) {
		await OutcomeConfigValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateOutcomeConfigDto, manager?: EntityManager) {
		await OutcomeConfigValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await OutcomeConfigValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
