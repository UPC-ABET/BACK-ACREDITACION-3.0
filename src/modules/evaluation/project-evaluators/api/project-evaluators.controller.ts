import { Body, Param, ParseIntPipe } from '@nestjs/common';
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
import {
	CreateProjectEvaluatorDto,
	UpdateProjectEvaluatorDto,
	FilterProjectEvaluatorDto,
} from '../model/project-evaluators.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const EVALUATION_MODULE = 'EVALUATION';

@SwaggerProjectEvaluatorController()
export class ProjectEvaluatorController extends BaseController<ProjectEvaluatorService> {
	constructor(private readonly service: ProjectEvaluatorService) {
		super(service);
	}

	@SwaggerProjectEvaluatorCreate()
	@RequirePermission({ module: EVALUATION_MODULE, action: 'POST' })
	async create(@Body() dto: CreateProjectEvaluatorDto) {
		return await super.create(dto);
	}

	@SwaggerProjectEvaluatorUpdate()
	@RequirePermission({ module: EVALUATION_MODULE, action: 'PATCH' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectEvaluatorDto) {
		return await super.update(id, dto);
	}

	@SwaggerProjectEvaluatorDelete()
	@RequirePermission({ module: EVALUATION_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerProjectEvaluatorGetAll()
	@RequirePermission({ module: EVALUATION_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProjectEvaluatorGetById()
	@RequirePermission({ module: EVALUATION_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProjectEvaluatorGetByFilters()
	@RequirePermission({ module: EVALUATION_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterProjectEvaluatorDto) {
		return await super.getByFilters(dto);
	}
}
