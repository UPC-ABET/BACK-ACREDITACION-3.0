import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { SwaggerStatusController, SwaggerStatusCreate, SwaggerStatusUpdate, SwaggerStatusDelete, SwaggerStatusGetAll, SwaggerStatusGetById, SwaggerStatusGetByFilters } from './docs/statuses.swagger';
import { StatusService } from './statuses.service';
import { CreateStatusDto, UpdateStatusDto, FilterStatusDto } from '../model/statuses.dtos';

@SwaggerStatusController()
export class StatusController extends BaseController<StatusService> {
	constructor(private readonly service: StatusService) {
		super(service);
	}

	@SwaggerStatusCreate()
	async create(@Body() dto: CreateStatusDto) {
		return await super.create(dto);
	}

	@SwaggerStatusUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateStatusDto) {
		return await super.update(id, dto);
	}

	@SwaggerStatusDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerStatusGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStatusGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerStatusGetByFilters()
	async getByFilters(@Body() dto: FilterStatusDto) {
		return await super.getByFilters(dto);
	}
}
