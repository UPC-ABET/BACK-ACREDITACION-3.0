import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { EvaluationRepository } from '../core/evaluations.repository';
import { EvaluationValidation } from '../core/evaluations.validation';

import { CreateEvaluationDto, UpdateEvaluationDto } from '../model/evaluations.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class EvaluationService extends BaseService<EvaluationRepository> {
	constructor(
		protected readonly repository: EvaluationRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateEvaluationDto, manager?: EntityManager) {
		await EvaluationValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateEvaluationDto, manager?: EntityManager) {
		await EvaluationValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await EvaluationValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
