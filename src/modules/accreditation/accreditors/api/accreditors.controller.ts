import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerAccreditorController,
	SwaggerAccreditorCreate,
	SwaggerAccreditorUpdate,
	SwaggerAccreditorDelete,
	SwaggerAccreditorGetAll,
	SwaggerAccreditorGetById,
	SwaggerAccreditorGetByFilters,
} from './docs/accreditors.swagger';
import { AccreditorService } from './accreditors.service';
import {
	CreateAccreditorDto,
	UpdateAccreditorDto,
	FilterAccreditorDto,
} from '../model/accreditors.dtos';

@SwaggerAccreditorController()
export class AccreditorController extends BaseController<AccreditorService> {
	constructor(private readonly service: AccreditorService) {
		super(service);
	}

	@SwaggerAccreditorCreate()
	async create(@Body() dto: CreateAccreditorDto) {
		return await super.create(dto);
	}

	@SwaggerAccreditorUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAccreditorDto) {
		return await super.update(id, dto);
	}

	@SwaggerAccreditorDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerAccreditorGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerAccreditorGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerAccreditorGetByFilters()
	async getByFilters(@Body() dto: FilterAccreditorDto) {
		return await super.getByFilters(dto);
	}
}
