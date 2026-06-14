import { Body, HttpStatus, Param, ParseIntPipe, Query } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerEnrolledStudentController,
	SwaggerEnrolledStudentCreate,
	SwaggerEnrolledStudentUpdate,
	SwaggerEnrolledStudentDelete,
	SwaggerEnrolledStudentGetAll,
	SwaggerEnrolledStudentGetById,
	SwaggerEnrolledStudentGetByFilters,
	SwaggerEnrolledStudentMaintenanceCreate,
	SwaggerEnrolledStudentMaintenanceList,
	SwaggerEnrolledStudentMaintenanceUpdate,
	SwaggerEnrolledStudentMaintenanceDelete,
} from './docs/enrolled-students.swagger';
import { EnrolledStudentService } from './enrolled-students.service';
import {
	CreateEnrolledStudentDto,
	UpdateEnrolledStudentDto,
	FilterEnrolledStudentDto,
	EnrolledStudentMaintenanceQueryDto,
	UpdateEnrolledStudentMaintenanceDto,
	CreateEnrolledStudentMaintenanceDto,
} from '../model/enrolled-students.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerEnrolledStudentController()
export class EnrolledStudentController extends BaseController<EnrolledStudentService> {
	constructor(private readonly service: EnrolledStudentService) {
		super(service);
	}

	@SwaggerEnrolledStudentCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateEnrolledStudentDto) {
		return await super.create(dto);
	}

	@SwaggerEnrolledStudentUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEnrolledStudentDto) {
		return await super.update(id, dto);
	}

	@SwaggerEnrolledStudentDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerEnrolledStudentGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerEnrolledStudentGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerEnrolledStudentGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterEnrolledStudentDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerEnrolledStudentMaintenanceCreate()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async maintenanceCreate(
		@AcademicPeriodId() academicPeriodId: number,
		@Body() dto: CreateEnrolledStudentMaintenanceDto,
	) {
		return parseSuccessResponse(
			await this.service.createMaintenance(academicPeriodId, dto),
			HttpStatus.CREATED,
		);
	}

	@SwaggerEnrolledStudentMaintenanceList()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async maintenanceList(
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: EnrolledStudentMaintenanceQueryDto,
	) {
		return parseSuccessResponse(await this.service.getMaintenanceList(academicPeriodId, query));
	}

	@SwaggerEnrolledStudentMaintenanceUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async maintenanceUpdate(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateEnrolledStudentMaintenanceDto,
	) {
		return parseSuccessResponse(await this.service.updateMaintenance(id, dto));
	}

	@SwaggerEnrolledStudentMaintenanceDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async maintenanceDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.deleteMaintenance(id));
	}
}
