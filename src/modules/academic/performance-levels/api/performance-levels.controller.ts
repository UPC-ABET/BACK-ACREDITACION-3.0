import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerPerformanceLevelController,
	SwaggerPerformanceLevelCreate,
	SwaggerPerformanceLevelUpdate,
	SwaggerPerformanceLevelDelete,
	SwaggerPerformanceLevelGetAll,
	SwaggerPerformanceLevelGetById,
	SwaggerPerformanceLevelGetByFilters,
} from './docs/performance-levels.swagger';
import { PerformanceLevelService } from './performance-levels.service';
import {
	CreatePerformanceLevelDto,
	UpdatePerformanceLevelDto,
	FilterPerformanceLevelDto,
} from '../model/performance-levels.dtos';

@SwaggerPerformanceLevelController()
export class PerformanceLevelController extends BaseController<PerformanceLevelService> {
	constructor(private readonly service: PerformanceLevelService) {
		super(service);
	}

	@SwaggerPerformanceLevelCreate()
	async create(@Body() dto: CreatePerformanceLevelDto) {
		return await super.create(dto);
	}

	@SwaggerPerformanceLevelUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePerformanceLevelDto) {
		return await super.update(id, dto);
	}

	@SwaggerPerformanceLevelDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerPerformanceLevelGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerPerformanceLevelGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerPerformanceLevelGetByFilters()
	async getByFilters(@Body() dto: FilterPerformanceLevelDto) {
		return await super.getByFilters(dto);
	}
}
