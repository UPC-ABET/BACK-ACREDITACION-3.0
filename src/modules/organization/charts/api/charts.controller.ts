import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { SwaggerChartController, SwaggerChartCreate, SwaggerChartUpdate, SwaggerChartDelete, SwaggerChartGetAll, SwaggerChartGetById, SwaggerChartGetByFilters } from './docs/charts.swagger';
import { ChartService } from './charts.service';
import { CreateChartDto, UpdateChartDto, FilterChartDto } from '../model/charts.dtos';

@SwaggerChartController()
export class ChartController extends BaseController<ChartService> {
	constructor(private readonly service: ChartService) {
		super(service);
	}

	@SwaggerChartCreate()
	async create(@Body() dto: CreateChartDto) {
		return await super.create(dto);
	}

	@SwaggerChartUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateChartDto) {
		return await super.update(id, dto);
	}

	@SwaggerChartDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerChartGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerChartGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerChartGetByFilters()
	async getByFilters(@Body() dto: FilterChartDto) {
		return await super.getByFilters(dto);
	}
}
