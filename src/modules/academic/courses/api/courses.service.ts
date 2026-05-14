import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { CourseRepository } from '../core/courses.repository';
import { CourseValidation } from '../core/courses.validation';

import { CreateCourseDto, UpdateCourseDto } from '../model/courses.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class CourseService extends BaseService<CourseRepository> {
	constructor(
		protected readonly repository: CourseRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateCourseDto, manager?: EntityManager) {
		await CourseValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateCourseDto, manager?: EntityManager) {
		await CourseValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await CourseValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
