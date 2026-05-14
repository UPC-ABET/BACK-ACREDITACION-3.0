import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { RubricQuestionCriteriaRepository } from '../core/rubric-question-criterias.repository';
import { RubricQuestionCriteriaValidation } from '../core/rubric-question-criterias.validation';

import { CreateRubricQuestionCriteriaDto, UpdateRubricQuestionCriteriaDto } from '../model/rubric-question-criterias.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class RubricQuestionCriteriaService extends BaseService<RubricQuestionCriteriaRepository> {
	constructor(
		protected readonly repository: RubricQuestionCriteriaRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateRubricQuestionCriteriaDto, manager?: EntityManager) {
		await RubricQuestionCriteriaValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateRubricQuestionCriteriaDto, manager?: EntityManager) {
		await RubricQuestionCriteriaValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await RubricQuestionCriteriaValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
