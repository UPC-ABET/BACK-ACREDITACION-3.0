import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerTypeGroupController,
	SwaggerTypeGroupCreate,
	SwaggerTypeGroupUpdate,
	SwaggerTypeGroupDelete,
	SwaggerTypeGroupGetAll,
	SwaggerTypeGroupGetById,
	SwaggerTypeGroupGetByFilters,
} from './docs/type-groups.swagger';
import { TypeGroupService } from './type-groups.service';
import {
	CreateTypeGroupDto,
	UpdateTypeGroupDto,
	FilterTypeGroupDto,
} from '../model/type-groups.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const CORE_MODULE = 'CORE';

@SwaggerTypeGroupController()
export class TypeGroupController extends BaseController<TypeGroupService> {
	constructor(private readonly service: TypeGroupService) {
		super(service);
	}

	@SwaggerTypeGroupCreate()
	@RequirePermission({ module: CORE_MODULE, action: 'POST' })
	async create(@Body() dto: CreateTypeGroupDto) {
		return await super.create(dto);
	}

	@SwaggerTypeGroupUpdate()
	@RequirePermission({ module: CORE_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTypeGroupDto) {
		return await super.update(id, dto);
	}

	@SwaggerTypeGroupDelete()
	@RequirePermission({ module: CORE_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerTypeGroupGetAll()
	@RequirePermission({ module: CORE_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerTypeGroupGetById()
	@RequirePermission({ module: CORE_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerTypeGroupGetByFilters()
	@RequirePermission({ module: CORE_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterTypeGroupDto) {
		return await super.getByFilters(dto);
	}
}
