import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ProjectEvaluatorRepository } from '../core/project-evaluators.repository';
import { ProjectEvaluatorValidation } from '../core/project-evaluators.validation';

import {
	CreateProjectEvaluatorDto,
	UpdateProjectEvaluatorDto,
} from '../model/project-evaluators.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ProjectEvaluatorService extends BaseService<ProjectEvaluatorRepository> {
	constructor(
		protected readonly repository: ProjectEvaluatorRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateProjectEvaluatorDto, manager?: EntityManager) {
		await ProjectEvaluatorValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateProjectEvaluatorDto, manager?: EntityManager) {
		await ProjectEvaluatorValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ProjectEvaluatorValidation.validateDelete(this.repository, id);
		return await this.repository.update(id, { isActive: false } as any, manager);
	}
}
