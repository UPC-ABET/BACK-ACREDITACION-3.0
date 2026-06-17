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
	SwaggerTypeSetCanEvaluate,
} from './docs/types.swagger';
import { TypeService } from './types.service';
import {
	CreateTypeDto,
	UpdateTypeDto,
	FilterTypeDto,
	SetCanEvaluateDto,
} from '../model/types.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerTypeController()
export class TypeController extends BaseController<TypeService> {
	constructor(private readonly service: TypeService) {
		super(service);
	}

	@SwaggerTypeCreate()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateTypeDto) {
		return await super.create(dto);
	}

	@SwaggerTypeUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTypeDto) {
		return await super.update(id, dto);
	}

	@SwaggerTypeDelete()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerTypeGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerTypeGetById()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerTypeGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterTypeDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerTypesByGroupCode()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.GET })
	async byGroupCode(@Param('code') code: string) {
		return parseSuccessResponse(await this.service.findByGroupCode(code));
	}

	@SwaggerTypeSetCanEvaluate()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.PATCH })
	async setCanEvaluate(@Param('id', ParseIntPipe) id: number, @Body() dto: SetCanEvaluateDto) {
		await this.service.setCanEvaluate(id, dto);
		return parseSuccessResponse(null);
	}
}
