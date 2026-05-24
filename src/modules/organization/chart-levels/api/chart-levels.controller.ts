import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerChartLevelController,
	SwaggerChartLevelCreate,
	SwaggerChartLevelUpdate,
	SwaggerChartLevelDelete,
	SwaggerChartLevelGetAll,
	SwaggerChartLevelGetById,
	SwaggerChartLevelGetByFilters,
} from './docs/chart-levels.swagger';
import { ChartLevelService } from './chart-levels.service';
import {
	CreateChartLevelDto,
	UpdateChartLevelDto,
	FilterChartLevelDto,
} from '../model/chart-levels.dtos';

@SwaggerChartLevelController()
export class ChartLevelController extends BaseController<ChartLevelService> {
	constructor(private readonly service: ChartLevelService) {
		super(service);
	}

	@SwaggerChartLevelCreate()
	async create(@Body() dto: CreateChartLevelDto) {
		return await super.create(dto);
	}

	@SwaggerChartLevelUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateChartLevelDto) {
		return await super.update(id, dto);
	}

	@SwaggerChartLevelDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerChartLevelGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerChartLevelGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerChartLevelGetByFilters()
	async getByFilters(@Body() dto: FilterChartLevelDto) {
		return await super.getByFilters(dto);
	}
}
