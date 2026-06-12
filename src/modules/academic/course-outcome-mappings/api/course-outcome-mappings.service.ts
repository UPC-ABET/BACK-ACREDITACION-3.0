import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { CourseOutcomeMappingRepository } from '../core/course-outcome-mappings.repository';
import { CourseOutcomeMappingValidation } from '../core/course-outcome-mappings.validation';

import {
	CreateCourseOutcomeMappingDto,
	UpdateCourseOutcomeMappingDto,
	FilterCourseOutcomeMappingMaintenanceDto,
	BulkSaveCourseOutcomeMappingDto,
} from '../model/course-outcome-mappings.dtos';
import { DataSource, EntityManager } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { courseOutcomeMappingsValidationStrings } from '../config/strings/course-outcome-mappings.validation';

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

	async getMaintenanceFilters(filters: FilterCourseOutcomeMappingMaintenanceDto) {
		return await this.repository.getMaintenanceFilters(filters);
	}

	async getMaintenanceView(programCommissionId: number) {
		const view = await this.repository.getMaintenanceView(programCommissionId);
		if (!view) {
			throw new HttpException(
				{ message: courseOutcomeMappingsValidationStrings.error.programCommissionNotFound },
				HttpStatus.NOT_FOUND,
			);
		}
		return view;
	}

	async bulkSaveMaintenance(dto: BulkSaveCourseOutcomeMappingDto) {
		await CourseOutcomeMappingValidation.validateBulkSave(this.repository, dto);
		await this.repository.bulkSaveMaintenance(dto.programCommissionId, dto.courses);
		return { programCommissionId: dto.programCommissionId };
	}
}
