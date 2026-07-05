import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { EntityManager } from 'typeorm';
import { ProjectGroupRepository } from '../core/project-groups.repository';
import { ProjectGroupValidation } from '../core/project-groups.validation';
import {
	CreateProjectGroupDto,
	FilterProjectGroupDto,
	UpdateProjectGroupDto,
} from '../model/project-groups.dtos';

@Injectable()
export class ProjectGroupService extends BaseService<ProjectGroupRepository> {
	constructor(protected readonly repository: ProjectGroupRepository) {
		super(repository);
	}

	async create(dto: CreateProjectGroupDto, manager?: EntityManager) {
		await ProjectGroupValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateProjectGroupDto, manager?: EntityManager) {
		await ProjectGroupValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ProjectGroupValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	override async getByFilters(filters: FilterProjectGroupDto) {
		return this.normalizeJsonbColumns(await this.repository.getByFilters(filters));
	}
}
