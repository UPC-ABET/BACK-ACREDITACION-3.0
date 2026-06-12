import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerCourseOutcomeMappingController,
	SwaggerCourseOutcomeMappingCreate,
	SwaggerCourseOutcomeMappingUpdate,
	SwaggerCourseOutcomeMappingDelete,
	SwaggerCourseOutcomeMappingGetAll,
	SwaggerCourseOutcomeMappingGetById,
	SwaggerCourseOutcomeMappingGetByFilters,
	SwaggerCourseOutcomeMappingMaintenanceGetByFilters,
	SwaggerCourseOutcomeMappingMaintenanceView,
	SwaggerCourseOutcomeMappingMaintenanceBulkSave,
} from './docs/course-outcome-mappings.swagger';
import { CourseOutcomeMappingService } from './course-outcome-mappings.service';
import {
	CreateCourseOutcomeMappingDto,
	UpdateCourseOutcomeMappingDto,
	FilterCourseOutcomeMappingDto,
	FilterCourseOutcomeMappingMaintenanceDto,
	CourseOutcomeMappingViewDto,
	BulkSaveCourseOutcomeMappingDto,
} from '../model/course-outcome-mappings.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerCourseOutcomeMappingController()
export class CourseOutcomeMappingController extends BaseController<CourseOutcomeMappingService> {
	constructor(private readonly service: CourseOutcomeMappingService) {
		super(service);
	}

	@SwaggerCourseOutcomeMappingCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateCourseOutcomeMappingDto) {
		return await super.create(dto);
	}

	@SwaggerCourseOutcomeMappingUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseOutcomeMappingDto) {
		return await super.update(id, dto);
	}

	@SwaggerCourseOutcomeMappingDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerCourseOutcomeMappingGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCourseOutcomeMappingGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerCourseOutcomeMappingGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterCourseOutcomeMappingDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerCourseOutcomeMappingMaintenanceGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async maintenanceGetByFilters(@Body() dto: FilterCourseOutcomeMappingMaintenanceDto) {
		return await this.service.getMaintenanceFilters(dto);
	}

	@SwaggerCourseOutcomeMappingMaintenanceView()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async maintenanceView(@Body() dto: CourseOutcomeMappingViewDto) {
		return await this.service.getMaintenanceView(dto.programCommissionId);
	}

	@SwaggerCourseOutcomeMappingMaintenanceBulkSave()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async maintenanceBulkSave(@Body() dto: BulkSaveCourseOutcomeMappingDto) {
		return await this.service.bulkSaveMaintenance(dto);
	}
}
