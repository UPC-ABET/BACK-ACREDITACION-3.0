import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { SwaggerPlanController, SwaggerPlanCreate, SwaggerPlanUpdate, SwaggerPlanDelete, SwaggerPlanGetAll, SwaggerPlanGetById, SwaggerPlanGetByFilters } from './docs/plans.swagger';
import { PlanService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto, FilterPlanDto } from '../model/plans.dtos';

@SwaggerPlanController()
export class PlanController extends BaseController<PlanService> {
	constructor(private readonly service: PlanService) {
		super(service);
	}

	@SwaggerPlanCreate()
	async create(@Body() dto: CreatePlanDto) {
		return await super.create(dto);
	}

	@SwaggerPlanUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdatePlanDto) {
		return await super.update(id, dto);
	}

	@SwaggerPlanDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerPlanGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerPlanGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerPlanGetByFilters()
	async getByFilters(@Body() dto: FilterPlanDto) {
		return await super.getByFilters(dto);
	}
}
