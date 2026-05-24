import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { StudyPlanCourseRepository } from '../core/study-plan-courses.repository';
import { StudyPlanCourseValidation } from '../core/study-plan-courses.validation';

import {
	CreateStudyPlanCourseDto,
	UpdateStudyPlanCourseDto,
	FilterStudyPlanCourseDto,
} from '../model/study-plan-courses.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class StudyPlanCourseService extends BaseService<StudyPlanCourseRepository> {
	constructor(
		protected readonly repository: StudyPlanCourseRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateStudyPlanCourseDto, manager?: EntityManager) {
		await StudyPlanCourseValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateStudyPlanCourseDto, manager?: EntityManager) {
		await StudyPlanCourseValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await StudyPlanCourseValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getByFilters(filters: FilterStudyPlanCourseDto) {
		return await this.repository.getByFilters(filters);
	}
}
