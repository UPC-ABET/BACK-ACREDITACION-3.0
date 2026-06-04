import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerPlanActionController,
	SwaggerPlanActionCreate,
	SwaggerPlanActionUpdate,
	SwaggerPlanActionDelete,
	SwaggerPlanActionGetAll,
	SwaggerPlanActionGetById,
	SwaggerPlanActionGetByFilters,
} from './docs/plan-actions.swagger';
import { PlanActionService } from './plan-actions.service';
import {
	CreatePlanActionDto,
	UpdatePlanActionDto,
	FilterPlanActionDto,
} from '../model/plan-actions.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerPlanActionController()
export class PlanActionController extends BaseController<PlanActionService> {
	constructor(private readonly service: PlanActionService) {
		super(service);
	}

	@SwaggerPlanActionCreate()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreatePlanActionDto) {
		return await super.create(dto);
	}

	@SwaggerPlanActionUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanActionDto) {
		return await super.update(id, dto);
	}

	@SwaggerPlanActionDelete()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerPlanActionGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerPlanActionGetById()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerPlanActionGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.IMPROVEMENT, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterPlanActionDto) {
		return await super.getByFilters(dto);
	}
}
