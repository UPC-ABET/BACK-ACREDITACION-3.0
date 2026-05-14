import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { RubricOutcomeCriteriaRepository } from '../core/rubric-outcome-criterias.repository';
import { RubricOutcomeCriteriaValidation } from '../core/rubric-outcome-criterias.validation';

import { CreateRubricOutcomeCriteriaDto, UpdateRubricOutcomeCriteriaDto } from '../model/rubric-outcome-criterias.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class RubricOutcomeCriteriaService extends BaseService<RubricOutcomeCriteriaRepository> {
	constructor(
		protected readonly repository: RubricOutcomeCriteriaRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateRubricOutcomeCriteriaDto, manager?: EntityManager) {
		await RubricOutcomeCriteriaValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateRubricOutcomeCriteriaDto, manager?: EntityManager) {
		await RubricOutcomeCriteriaValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await RubricOutcomeCriteriaValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
