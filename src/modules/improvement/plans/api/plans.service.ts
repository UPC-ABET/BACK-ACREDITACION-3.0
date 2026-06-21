import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { PlanRepository } from '../core/plans.repository';
import { PlanValidation } from '../core/plans.validation';

import { CreatePlanDto, UpdatePlanDto } from '../model/plans.dtos';
import { EntityManager } from 'typeorm';

@Injectable()
export class PlanService extends BaseService<PlanRepository> {
	constructor(protected readonly repository: PlanRepository) {
		super(repository);
	}

	async create(dto: CreatePlanDto, manager?: EntityManager) {
		await PlanValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdatePlanDto, manager?: EntityManager) {
		await PlanValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await PlanValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
