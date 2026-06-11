import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerProjectStudentController,
	SwaggerProjectStudentCreate,
	SwaggerProjectStudentUpdate,
	SwaggerProjectStudentDelete,
	SwaggerProjectStudentGetAll,
	SwaggerProjectStudentGetById,
	SwaggerProjectStudentGetByFilters,
} from './docs/project-students.swagger';
import { ProjectStudentService } from './project-students.service';
import {
	CreateProjectStudentDto,
	UpdateProjectStudentDto,
	FilterProjectStudentDto,
} from '../model/project-students.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerProjectStudentController()
export class ProjectStudentController extends BaseController<ProjectStudentService> {
	constructor(private readonly service: ProjectStudentService) {
		super(service);
	}

	@SwaggerProjectStudentCreate()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateProjectStudentDto) {
		return await super.create(dto);
	}

	@SwaggerProjectStudentUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.PATCH })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectStudentDto) {
		return await super.update(id, dto);
	}

	@SwaggerProjectStudentDelete()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerProjectStudentGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProjectStudentGetById()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProjectStudentGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterProjectStudentDto) {
		return await super.getByFilters(dto);
	}
}
