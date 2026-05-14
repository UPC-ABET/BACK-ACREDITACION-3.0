import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { RubricScaleRepository } from '../core/rubric-scales.repository';
import { RubricScaleValidation } from '../core/rubric-scales.validation';

import { CreateRubricScaleDto, UpdateRubricScaleDto } from '../model/rubric-scales.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class RubricScaleService extends BaseService<RubricScaleRepository> {
	constructor(
		protected readonly repository: RubricScaleRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateRubricScaleDto, manager?: EntityManager) {
		await RubricScaleValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateRubricScaleDto, manager?: EntityManager) {
		await RubricScaleValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await RubricScaleValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
