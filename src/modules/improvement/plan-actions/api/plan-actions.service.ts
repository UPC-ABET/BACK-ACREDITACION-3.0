import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { PlanActionRepository } from '../core/plan-actions.repository';
import { PlanActionValidation } from '../core/plan-actions.validation';

import { CreatePlanActionDto, UpdatePlanActionDto } from '../model/plan-actions.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class PlanActionService extends BaseService<PlanActionRepository> {
	constructor(
		protected readonly repository: PlanActionRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreatePlanActionDto, manager?: EntityManager) {
		await PlanActionValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdatePlanActionDto, manager?: EntityManager) {
		await PlanActionValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await PlanActionValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
