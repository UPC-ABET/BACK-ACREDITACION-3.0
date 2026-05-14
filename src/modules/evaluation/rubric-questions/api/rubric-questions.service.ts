import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { RubricQuestionRepository } from '../core/rubric-questions.repository';
import { RubricQuestionValidation } from '../core/rubric-questions.validation';

import { CreateRubricQuestionDto, UpdateRubricQuestionDto } from '../model/rubric-questions.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class RubricQuestionService extends BaseService<RubricQuestionRepository> {
	constructor(
		protected readonly repository: RubricQuestionRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateRubricQuestionDto, manager?: EntityManager) {
		await RubricQuestionValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateRubricQuestionDto, manager?: EntityManager) {
		await RubricQuestionValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await RubricQuestionValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
