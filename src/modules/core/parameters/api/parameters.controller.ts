import { Body, Param, ParseIntPipe } from '@nestjs/common';
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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const CORE_MODULE = 'CORE';

@SwaggerParameterController()
export class ParameterController extends BaseController<ParameterService> {
	constructor(private readonly service: ParameterService) {
		super(service);
	}

	@SwaggerParameterCreate()
	@RequirePermission({ module: CORE_MODULE, action: 'POST' })
	async create(@Body() dto: CreateParameterDto) {
		return await super.create(dto);
	}

	@SwaggerParameterUpdate()
	@RequirePermission({ module: CORE_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateParameterDto) {
		return await super.update(id, dto);
	}

	@SwaggerParameterDelete()
	@RequirePermission({ module: CORE_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerParameterGetAll()
	@RequirePermission({ module: CORE_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerParameterGetById()
	@RequirePermission({ module: CORE_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerParameterGetByFilters()
	@RequirePermission({ module: CORE_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterParameterDto) {
		return await super.getByFilters(dto);
	}
}
