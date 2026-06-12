import { Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudyPlanController,
	SwaggerStudyPlanCreate,
	SwaggerStudyPlanUpdate,
	SwaggerStudyPlanDelete,
	SwaggerStudyPlanGetAll,
	SwaggerStudyPlanGetById,
	SwaggerStudyPlanGetByFilters,
	SwaggerStudyPlanMaintenanceList,
	SwaggerStudyPlanMaintenanceUpdate,
	SwaggerStudyPlanMaintenanceDelete,
	SwaggerStudyPlanCoursesView,
} from './docs/study-plans.swagger';
import { StudyPlanService } from './study-plans.service';
import {
	CreateStudyPlanDto,
	UpdateStudyPlanDto,
	FilterStudyPlanDto,
	StudyPlanMaintenanceQueryDto,
	UpdateStudyPlanMaintenanceDto,
} from '../model/study-plans.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import {
	ModalityTypeId,
	ApiModalityTypeHeader,
} from 'src/modules/auth/protocols/jwt/decorators/modality-type-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerStudyPlanController()
export class StudyPlanController extends BaseController<StudyPlanService> {
	constructor(private readonly service: StudyPlanService) {
		super(service);
	}

	@SwaggerStudyPlanCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateStudyPlanDto) {
		return await super.create(dto);
	}

	@SwaggerStudyPlanUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudyPlanDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudyPlanDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStudyPlanGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudyPlanGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudyPlanGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterStudyPlanDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerStudyPlanMaintenanceList()
	@ApiModalityTypeHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async maintenanceList(
		@ModalityTypeId() modalityTypeId: number,
		@Query() query: StudyPlanMaintenanceQueryDto,
	) {
		return parseSuccessResponse(await this.service.getMaintenanceList(modalityTypeId, query));
	}

	@SwaggerStudyPlanMaintenanceUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async maintenanceUpdate(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateStudyPlanMaintenanceDto,
	) {
		return parseSuccessResponse(await this.service.updateMaintenance(id, dto));
	}

	@SwaggerStudyPlanMaintenanceDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async maintenanceDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.deleteMaintenance(id));
	}

	@SwaggerStudyPlanCoursesView()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async coursesView(
		@Param('id', ParseIntPipe) id: number,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(await this.service.getCoursesView(id, academicPeriodId));
	}
}
