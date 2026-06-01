import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { parseSuccessResponse } from 'src/libs/global.functions';
import {
	SwaggerTypeController,
	SwaggerTypeCreate,
	SwaggerTypeUpdate,
	SwaggerTypeDelete,
	SwaggerTypeGetAll,
	SwaggerTypeGetById,
	SwaggerTypeGetByFilters,
	SwaggerTypesByGroupCode,
} from './docs/types.swagger';
import { TypeService } from './types.service';
import { CreateTypeDto, UpdateTypeDto, FilterTypeDto } from '../model/types.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const CORE_MODULE = 'CORE';

@SwaggerTypeController()
export class TypeController extends BaseController<TypeService> {
	constructor(private readonly service: TypeService) {
		super(service);
	}

	@SwaggerTypeCreate()
	@RequirePermission({ module: CORE_MODULE, action: 'POST' })
	async create(@Body() dto: CreateTypeDto) {
		return await super.create(dto);
	}

	@SwaggerTypeUpdate()
	@RequirePermission({ module: CORE_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTypeDto) {
		return await super.update(id, dto);
	}

	@SwaggerTypeDelete()
	@RequirePermission({ module: CORE_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerTypeGetAll()
	@RequirePermission({ module: CORE_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerTypeGetById()
	@RequirePermission({ module: CORE_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerTypeGetByFilters()
	@RequirePermission({ module: CORE_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterTypeDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerTypesByGroupCode()
	@RequirePermission({ module: CORE_MODULE, action: 'GET' })
	async byGroupCode(@Param('code') code: string) {
		return parseSuccessResponse(await this.service.findByGroupCode(code));
	}
}
