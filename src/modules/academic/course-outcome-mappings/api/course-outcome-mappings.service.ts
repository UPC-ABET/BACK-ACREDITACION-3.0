import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { CourseOutcomeMappingRepository } from '../core/course-outcome-mappings.repository';
import { CourseOutcomeMappingValidation } from '../core/course-outcome-mappings.validation';

import {
	CreateCourseOutcomeMappingDto,
	UpdateCourseOutcomeMappingDto,
} from '../model/course-outcome-mappings.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class CourseOutcomeMappingService extends BaseService<CourseOutcomeMappingRepository> {
	constructor(
		protected readonly repository: CourseOutcomeMappingRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateCourseOutcomeMappingDto, manager?: EntityManager) {
		await CourseOutcomeMappingValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateCourseOutcomeMappingDto, manager?: EntityManager) {
		await CourseOutcomeMappingValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await CourseOutcomeMappingValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
