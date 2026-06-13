import { Body, HttpStatus, Param, ParseIntPipe, Query } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerCourseSectionController,
	SwaggerCourseSectionCreate,
	SwaggerCourseSectionUpdate,
	SwaggerCourseSectionDelete,
	SwaggerCourseSectionGetAll,
	SwaggerCourseSectionGetById,
	SwaggerCourseSectionGetByFilters,
	SwaggerCourseSectionMaintenanceCreate,
	SwaggerCourseSectionMaintenanceList,
	SwaggerCourseSectionMaintenanceUpdate,
	SwaggerCourseSectionMaintenanceDelete,
} from './docs/course-sections.swagger';
import { CourseSectionService } from './course-sections.service';
import {
	CreateCourseSectionDto,
	UpdateCourseSectionDto,
	FilterCourseSectionDto,
	CourseSectionMaintenanceQueryDto,
	UpdateCourseSectionMaintenanceDto,
	CreateCourseSectionMaintenanceDto,
} from '../model/course-sections.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerCourseSectionController()
export class CourseSectionController extends BaseController<CourseSectionService> {
	constructor(private readonly service: CourseSectionService) {
		super(service);
	}

	@SwaggerCourseSectionCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateCourseSectionDto) {
		return await super.create(dto);
	}

	@SwaggerCourseSectionUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseSectionDto) {
		return await super.update(id, dto);
	}

	@SwaggerCourseSectionDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerCourseSectionGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCourseSectionGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerCourseSectionGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterCourseSectionDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerCourseSectionMaintenanceCreate()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async maintenanceCreate(
		@AcademicPeriodId() academicPeriodId: number,
		@Body() dto: CreateCourseSectionMaintenanceDto,
	) {
		return parseSuccessResponse(
			await this.service.createMaintenance(academicPeriodId, dto),
			HttpStatus.CREATED,
		);
	}

	@SwaggerCourseSectionMaintenanceList()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async maintenanceList(
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: CourseSectionMaintenanceQueryDto,
	) {
		return parseSuccessResponse(await this.service.getMaintenanceList(academicPeriodId, query));
	}

	@SwaggerCourseSectionMaintenanceUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async maintenanceUpdate(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateCourseSectionMaintenanceDto,
	) {
		return parseSuccessResponse(await this.service.updateMaintenance(id, dto));
	}

	@SwaggerCourseSectionMaintenanceDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async maintenanceDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.deleteMaintenance(id));
	}
}
