import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerProjectEvaluatorController,
	SwaggerProjectEvaluatorCreate,
	SwaggerProjectEvaluatorUpdate,
	SwaggerProjectEvaluatorDelete,
	SwaggerProjectEvaluatorGetAll,
	SwaggerProjectEvaluatorGetById,
	SwaggerProjectEvaluatorGetByFilters,
} from './docs/project-evaluators.swagger';
import { ProjectEvaluatorService } from './project-evaluators.service';
import { CreateProjectEvaluatorDto, UpdateProjectEvaluatorDto, FilterProjectEvaluatorDto } from '../model/project-evaluators.dtos';

@SwaggerProjectEvaluatorController()
export class ProjectEvaluatorController extends BaseController<ProjectEvaluatorService> {
	constructor(private readonly service: ProjectEvaluatorService) {
		super(service);
	}

	@SwaggerProjectEvaluatorCreate()
	async create(@Body() dto: CreateProjectEvaluatorDto) {
		return await super.create(dto);
	}

	@SwaggerProjectEvaluatorUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateProjectEvaluatorDto) {
		return await super.update(id, dto);
	}

	@SwaggerProjectEvaluatorDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerProjectEvaluatorGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProjectEvaluatorGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerProjectEvaluatorGetByFilters()
	async getByFilters(@Body() dto: FilterProjectEvaluatorDto) {
		return await super.getByFilters(dto);
	}
}
