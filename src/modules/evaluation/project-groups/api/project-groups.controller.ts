import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { parseSuccessResponse } from 'src/libs/global.functions';
import {
	SwaggerProjectGroupController,
	SwaggerProjectGroupCreate,
	SwaggerProjectGroupUpdate,
	SwaggerProjectGroupDelete,
	SwaggerProjectGroupGetAll,
	SwaggerProjectGroupGetById,
	SwaggerProjectGroupGetByFilters,
} from './docs/project-groups.swagger';
import { ProjectGroupService } from './project-groups.service';
import {
	CreateProjectGroupDto,
	UpdateProjectGroupDto,
	FilterProjectGroupDto,
} from '../model/project-groups.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerProjectGroupController()
export class ProjectGroupController extends BaseController<ProjectGroupService> {
	constructor(private readonly service: ProjectGroupService) {
		super(service);
	}

	@SwaggerProjectGroupCreate()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateProjectGroupDto) {
		return await super.create(dto);
	}

	@SwaggerProjectGroupUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.PATCH })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectGroupDto) {
		return await super.update(id, dto);
	}

	@SwaggerProjectGroupDelete()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerProjectGroupGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProjectGroupGetById()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProjectGroupGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterProjectGroupDto) {
		return parseSuccessResponse(await this.service.getByFilters(dto));
	}
}
