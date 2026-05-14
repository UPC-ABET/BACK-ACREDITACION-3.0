import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { PerformanceLevelRepository } from '../core/performance-levels.repository';
import { PerformanceLevelValidation } from '../core/performance-levels.validation';

import { CreatePerformanceLevelDto, UpdatePerformanceLevelDto } from '../model/performance-levels.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class PerformanceLevelService extends BaseService<PerformanceLevelRepository> {
	constructor(
		protected readonly repository: PerformanceLevelRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreatePerformanceLevelDto, manager?: EntityManager) {
		await PerformanceLevelValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdatePerformanceLevelDto, manager?: EntityManager) {
		await PerformanceLevelValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await PerformanceLevelValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
