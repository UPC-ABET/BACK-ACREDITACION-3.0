import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { SurveyRepository } from '../core/surveys.repository';
import { SurveyValidation } from '../core/surveys.validation';

import { CreateSurveyDto, UpdateSurveyDto } from '../model/surveys.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class SurveyService extends BaseService<SurveyRepository> {
	constructor(
		protected readonly repository: SurveyRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateSurveyDto, manager?: EntityManager) {
		await SurveyValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateSurveyDto, manager?: EntityManager) {
		await SurveyValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await SurveyValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
