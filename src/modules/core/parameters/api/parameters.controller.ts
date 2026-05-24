import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerParameterController,
	SwaggerParameterCreate,
	SwaggerParameterUpdate,
	SwaggerParameterDelete,
	SwaggerParameterGetAll,
	SwaggerParameterGetById,
	SwaggerParameterGetByFilters,
} from './docs/parameters.swagger';
import { ParameterService } from './parameters.service';
import {
	CreateParameterDto,
	UpdateParameterDto,
	FilterParameterDto,
} from '../model/parameters.dtos';

@SwaggerParameterController()
export class ParameterController extends BaseController<ParameterService> {
	constructor(private readonly service: ParameterService) {
		super(service);
	}

	@SwaggerParameterCreate()
	async create(@Body() dto: CreateParameterDto) {
		return await super.create(dto);
	}

	@SwaggerParameterUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateParameterDto) {
		return await super.update(id, dto);
	}

	@SwaggerParameterDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerParameterGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerParameterGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerParameterGetByFilters()
	async getByFilters(@Body() dto: FilterParameterDto) {
		return await super.getByFilters(dto);
	}
}
