import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStatusController,
	SwaggerStatusCreate,
	SwaggerStatusUpdate,
	SwaggerStatusDelete,
	SwaggerStatusGetAll,
	SwaggerStatusGetById,
	SwaggerStatusGetByFilters,
} from './docs/statuses.swagger';
import { StatusService } from './statuses.service';
import { CreateStatusDto, UpdateStatusDto, FilterStatusDto } from '../model/statuses.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerStatusController()
export class StatusController extends BaseController<StatusService> {
	constructor(private readonly service: StatusService) {
		super(service);
	}

	@SwaggerStatusCreate()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateStatusDto) {
		return await super.create(dto);
	}

	@SwaggerStatusUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStatusDto) {
		return await super.update(id, dto);
	}

	@SwaggerStatusDelete()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStatusGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStatusGetById()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStatusGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterStatusDto) {
		return await super.getByFilters(dto);
	}
}
