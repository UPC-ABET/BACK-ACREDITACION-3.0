import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ChartLevelRepository } from '../core/chart-levels.repository';
import { ChartLevelValidation } from '../core/chart-levels.validation';

import { CreateChartLevelDto, UpdateChartLevelDto } from '../model/chart-levels.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ChartLevelService extends BaseService<ChartLevelRepository> {
	constructor(
		protected readonly repository: ChartLevelRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateChartLevelDto, manager?: EntityManager) {
		await ChartLevelValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateChartLevelDto, manager?: EntityManager) {
		await ChartLevelValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ChartLevelValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
