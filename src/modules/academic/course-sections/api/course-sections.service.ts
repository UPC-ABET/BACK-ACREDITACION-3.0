import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { CourseSectionRepository } from '../core/course-sections.repository';
import { CourseSectionValidation } from '../core/course-sections.validation';

import { CreateCourseSectionDto, UpdateCourseSectionDto } from '../model/course-sections.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class CourseSectionService extends BaseService<CourseSectionRepository> {
	constructor(
		protected readonly repository: CourseSectionRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateCourseSectionDto, manager?: EntityManager) {
		await CourseSectionValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateCourseSectionDto, manager?: EntityManager) {
		await CourseSectionValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await CourseSectionValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
