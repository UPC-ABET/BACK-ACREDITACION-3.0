import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ProjectRepository } from '../core/projects.repository';
import { ProjectValidation } from '../core/projects.validation';

import { CreateProjectDto, UpdateProjectDto } from '../model/projects.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ProjectService extends BaseService<ProjectRepository> {
	constructor(
		protected readonly repository: ProjectRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateProjectDto, manager?: EntityManager) {
		await ProjectValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateProjectDto, manager?: EntityManager) {
		await ProjectValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ProjectValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
