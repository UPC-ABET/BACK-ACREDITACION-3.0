import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ProjectStudentRepository } from '../core/project-students.repository';
import { ProjectStudentValidation } from '../core/project-students.validation';

import { CreateProjectStudentDto, UpdateProjectStudentDto } from '../model/project-students.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ProjectStudentService extends BaseService<ProjectStudentRepository> {
	constructor(
		protected readonly repository: ProjectStudentRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateProjectStudentDto, manager?: EntityManager) {
		await ProjectStudentValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateProjectStudentDto, manager?: EntityManager) {
		await ProjectStudentValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ProjectStudentValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
