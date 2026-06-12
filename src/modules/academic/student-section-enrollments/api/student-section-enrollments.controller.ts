import { Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudentSectionEnrollmentController,
	SwaggerStudentSectionEnrollmentCreate,
	SwaggerStudentSectionEnrollmentUpdate,
	SwaggerStudentSectionEnrollmentDelete,
	SwaggerStudentSectionEnrollmentGetAll,
	SwaggerStudentSectionEnrollmentGetById,
	SwaggerStudentSectionEnrollmentGetByFilters,
	SwaggerStudentSectionEnrollmentMaintenanceList,
	SwaggerStudentSectionEnrollmentMaintenanceUpdate,
	SwaggerStudentSectionEnrollmentMaintenanceDelete,
} from './docs/student-section-enrollments.swagger';
import { StudentSectionEnrollmentService } from './student-section-enrollments.service';
import {
	CreateStudentSectionEnrollmentDto,
	UpdateStudentSectionEnrollmentDto,
	FilterStudentSectionEnrollmentDto,
	StudentSectionEnrollmentMaintenanceQueryDto,
	UpdateStudentSectionEnrollmentMaintenanceDto,
} from '../model/student-section-enrollments.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerStudentSectionEnrollmentController()
export class StudentSectionEnrollmentController extends BaseController<StudentSectionEnrollmentService> {
	constructor(private readonly service: StudentSectionEnrollmentService) {
		super(service);
	}

	@SwaggerStudentSectionEnrollmentCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateStudentSectionEnrollmentDto) {
		return await super.create(dto);
	}

	@SwaggerStudentSectionEnrollmentUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async update(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateStudentSectionEnrollmentDto,
	) {
		return await super.update(id, dto);
	}

	@SwaggerStudentSectionEnrollmentDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStudentSectionEnrollmentGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudentSectionEnrollmentGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudentSectionEnrollmentGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterStudentSectionEnrollmentDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerStudentSectionEnrollmentMaintenanceList()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async maintenanceList(
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: StudentSectionEnrollmentMaintenanceQueryDto,
	) {
		return parseSuccessResponse(await this.service.getMaintenanceList(academicPeriodId, query));
	}

	@SwaggerStudentSectionEnrollmentMaintenanceUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async maintenanceUpdate(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateStudentSectionEnrollmentMaintenanceDto,
	) {
		return parseSuccessResponse(await this.service.updateMaintenance(id, dto));
	}

	@SwaggerStudentSectionEnrollmentMaintenanceDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async maintenanceDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.deleteMaintenance(id));
	}
}
