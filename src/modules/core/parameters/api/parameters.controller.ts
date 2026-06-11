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
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerParameterController()
export class ParameterController extends BaseController<ParameterService> {
	constructor(private readonly service: ParameterService) {
		super(service);
	}

	@SwaggerParameterCreate()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateParameterDto) {
		return await super.create(dto);
	}

	@SwaggerParameterUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateParameterDto) {
		return await super.update(id, dto);
	}

	@SwaggerParameterDelete()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerParameterGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerParameterGetById()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerParameterGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.CORE, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterParameterDto) {
		return await super.getByFilters(dto);
	}
}
