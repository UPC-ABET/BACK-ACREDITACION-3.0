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
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerProjectEvaluatorController()
export class ProjectEvaluatorController extends BaseController<ProjectEvaluatorService> {
	constructor(private readonly service: ProjectEvaluatorService) {
		super(service);
	}

	@SwaggerProjectEvaluatorCreate()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateProjectEvaluatorDto) {
		return await super.create(dto);
	}

	@SwaggerProjectEvaluatorUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.PATCH })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectEvaluatorDto) {
		return await super.update(id, dto);
	}

	@SwaggerProjectEvaluatorDelete()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerProjectEvaluatorGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProjectEvaluatorGetById()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProjectEvaluatorGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterProjectEvaluatorDto) {
		return await super.getByFilters(dto);
	}
}
