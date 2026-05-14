import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { StudyPlanRepository } from '../core/study-plans.repository';
import { StudyPlanValidation } from '../core/study-plans.validation';

import { CreateStudyPlanDto, UpdateStudyPlanDto } from '../model/study-plans.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class StudyPlanService extends BaseService<StudyPlanRepository> {
	constructor(
		protected readonly repository: StudyPlanRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateStudyPlanDto, manager?: EntityManager) {
		await StudyPlanValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateStudyPlanDto, manager?: EntityManager) {
		await StudyPlanValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await StudyPlanValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
