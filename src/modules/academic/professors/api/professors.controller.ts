import { Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerProfessorController,
	SwaggerProfessorCreate,
	SwaggerProfessorUpdate,
	SwaggerProfessorDelete,
	SwaggerProfessorGetAll,
	SwaggerProfessorGetById,
	SwaggerProfessorGetByFilters,
	SwaggerProfessorGetByUserId,
	SwaggerProfessorMaintenanceList,
	SwaggerProfessorMaintenanceUpdate,
	SwaggerProfessorMaintenanceDelete,
} from './docs/professors.swagger';
import { ProfessorService } from './professors.service';
import {
	CreateProfessorDto,
	UpdateProfessorDto,
	FilterProfessorDto,
	ProfessorMaintenanceQueryDto,
	UpdateProfessorMaintenanceDto,
} from '../model/professors.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerProfessorController()
export class ProfessorController extends BaseController<ProfessorService> {
	constructor(private readonly service: ProfessorService) {
		super(service);
	}

	@SwaggerProfessorCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateProfessorDto) {
		return await super.create(dto);
	}

	@SwaggerProfessorUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProfessorDto) {
		return await super.update(id, dto);
	}

	@SwaggerProfessorDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerProfessorGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProfessorGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProfessorGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterProfessorDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerProfessorGetByUserId()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getByUserId(@Param('id', ParseIntPipe) userId: number) {
		return parseSuccessResponse(await this.service.getByUserId(userId));
	}

	@SwaggerProfessorMaintenanceList()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async maintenanceList(@Query() query: ProfessorMaintenanceQueryDto) {
		return parseSuccessResponse(await this.service.getMaintenanceList(query));
	}

	@SwaggerProfessorMaintenanceUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async maintenanceUpdate(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateProfessorMaintenanceDto,
	) {
		return parseSuccessResponse(await this.service.updateMaintenance(id, dto));
	}

	@SwaggerProfessorMaintenanceDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async maintenanceDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.deleteMaintenance(id));
	}
}
