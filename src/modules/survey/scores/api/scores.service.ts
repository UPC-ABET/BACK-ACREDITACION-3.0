import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ScoreRepository } from '../core/scores.repository';
import { ScoreValidation } from '../core/scores.validation';

import { CreateScoreDto, UpdateScoreDto } from '../model/scores.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ScoreService extends BaseService<ScoreRepository> {
	constructor(
		protected readonly repository: ScoreRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateScoreDto, manager?: EntityManager) {
		await ScoreValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateScoreDto, manager?: EntityManager) {
		await ScoreValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ScoreValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
