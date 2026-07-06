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
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';

@SwaggerProjectGroupController()
export class ProjectGroupController extends BaseController<ProjectGroupService> {
	constructor(private readonly service: ProjectGroupService) {
		super(service);
	}

	@SwaggerProjectGroupCreate()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateProjectGroupDto, @AcademicPeriodId() academicPeriodId?: number) {
		return await super.create({ ...dto, academicPeriodId });
	}

	@SwaggerProjectGroupUpdate()
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.PATCH })
	async update(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateProjectGroupDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		const payload = academicPeriodId ? { ...dto, academicPeriodId } : dto;
		return await super.update(id, payload);
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
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(
		@Body() dto: FilterProjectGroupDto,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return parseSuccessResponse(await this.service.getByFilters({ ...dto, academicPeriodId }));
	}
}
