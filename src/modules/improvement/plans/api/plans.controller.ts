import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerPlanController,
	SwaggerPlanCreate,
	SwaggerPlanUpdate,
	SwaggerPlanDelete,
	SwaggerPlanGetAll,
	SwaggerPlanGetById,
	SwaggerPlanGetByFilters,
} from './docs/plans.swagger';
import { PlanService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto, FilterPlanDto } from '../model/plans.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const IMPROVEMENT_MODULE = 'IMPROVEMENT';

@SwaggerPlanController()
export class PlanController extends BaseController<PlanService> {
	constructor(private readonly service: PlanService) {
		super(service);
	}

	@SwaggerPlanCreate()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'POST' })
	async create(@Body() dto: CreatePlanDto) {
		return await super.create(dto);
	}

	@SwaggerPlanUpdate()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanDto) {
		return await super.update(id, dto);
	}

	@SwaggerPlanDelete()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerPlanGetAll()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerPlanGetById()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerPlanGetByFilters()
	@RequirePermission({ module: IMPROVEMENT_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterPlanDto) {
		return await super.getByFilters(dto);
	}
}
