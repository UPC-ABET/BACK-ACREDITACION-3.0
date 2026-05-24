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

@SwaggerPlanActionController()
export class PlanActionController extends BaseController<PlanActionService> {
	constructor(private readonly service: PlanActionService) {
		super(service);
	}

	@SwaggerPlanActionCreate()
	async create(@Body() dto: CreatePlanActionDto) {
		return await super.create(dto);
	}

	@SwaggerPlanActionUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanActionDto) {
		return await super.update(id, dto);
	}

	@SwaggerPlanActionDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerPlanActionGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerPlanActionGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerPlanActionGetByFilters()
	async getByFilters(@Body() dto: FilterPlanActionDto) {
		return await super.getByFilters(dto);
	}
}
