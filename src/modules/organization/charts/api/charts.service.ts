import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ChartRepository } from '../core/charts.repository';
import { ChartValidation } from '../core/charts.validation';

import { CreateChartDto, UpdateChartDto } from '../model/charts.dtos';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ChartService extends BaseService<ChartRepository> {
	constructor(
		protected readonly repository: ChartRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateChartDto, manager?: EntityManager) {
		await ChartValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateChartDto, manager?: EntityManager) {
		await ChartValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ChartValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}
}
