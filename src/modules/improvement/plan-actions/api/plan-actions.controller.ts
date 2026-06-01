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

const IMPROVEMENT_MODULE = 'IMPROVEMENT';

@SwaggerPlanActionController()
export class PlanActionController extends BaseController<PlanActionService> {
	constructor(private readonly service: PlanActionService) {
		super(service);
	}

	@SwaggerPlanActionCreate()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'POST' })
	async create(@Body() dto: CreatePlanActionDto) {
		return await super.create(dto);
	}

	@SwaggerPlanActionUpdate()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanActionDto) {
		return await super.update(id, dto);
	}

	@SwaggerPlanActionDelete()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerPlanActionGetAll()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerPlanActionGetById()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerPlanActionGetByFilters()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterPlanActionDto) {
		return await super.getByFilters(dto);
	}
}
