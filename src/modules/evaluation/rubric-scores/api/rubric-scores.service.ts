import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { RubricScoreRepository } from '../core/rubric-scores.repository';
import { RubricScoreValidation } from '../core/rubric-scores.validation';

import { CreateRubricScoreDto, UpdateRubricScoreDto } from '../model/rubric-scores.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class RubricScoreService extends BaseService<RubricScoreRepository> {
	constructor(
		protected readonly repository: RubricScoreRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateRubricScoreDto, manager?: EntityManager) {
		await RubricScoreValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateRubricScoreDto, manager?: EntityManager) {
		await RubricScoreValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await RubricScoreValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
