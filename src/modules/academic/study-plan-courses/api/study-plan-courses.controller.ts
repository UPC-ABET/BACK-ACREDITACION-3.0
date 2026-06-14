import { Body, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudyPlanCourseController,
	SwaggerStudyPlanCourseCreate,
	SwaggerStudyPlanCourseUpdate,
	SwaggerStudyPlanCourseDelete,
	SwaggerStudyPlanCourseGetAll,
	SwaggerStudyPlanCourseGetById,
	SwaggerStudyPlanCourseGetByFilters,
	SwaggerStudyPlanCourseEnableEvaluation,
	SwaggerStudyPlanCourseMaintenanceCreate,
	SwaggerStudyPlanCourseMaintenanceDelete,
} from './docs/study-plan-courses.swagger';
import { StudyPlanCourseService } from './study-plan-courses.service';
import {
	CreateStudyPlanCourseDto,
	UpdateStudyPlanCourseDto,
	FilterStudyPlanCourseDto,
	EnableEvaluationDto,
	CreateStudyPlanCourseMaintenanceDto,
} from '../model/study-plan-courses.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerStudyPlanCourseController()
export class StudyPlanCourseController extends BaseController<StudyPlanCourseService> {
	constructor(private readonly service: StudyPlanCourseService) {
		super(service);
	}

	@SwaggerStudyPlanCourseCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateStudyPlanCourseDto) {
		return await super.create(dto);
	}

	@SwaggerStudyPlanCourseUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudyPlanCourseDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudyPlanCourseDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStudyPlanCourseGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudyPlanCourseGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudyPlanCourseGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterStudyPlanCourseDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerStudyPlanCourseEnableEvaluation()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PATCH })
	async enableEvaluation(@Param('id', ParseIntPipe) id: number, @Body() dto: EnableEvaluationDto) {
		await this.service.enableEvaluation(id, dto);
		return parseSuccessResponse(null);
	}

	@SwaggerStudyPlanCourseMaintenanceCreate()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async maintenanceCreate(
		@AcademicPeriodId() academicPeriodId: number,
		@Body() dto: CreateStudyPlanCourseMaintenanceDto,
	) {
		return parseSuccessResponse(
			await this.service.createMaintenance(academicPeriodId, dto),
			HttpStatus.CREATED,
		);
	}

	@SwaggerStudyPlanCourseMaintenanceDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async maintenanceDelete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.deleteMaintenance(id));
	}
}
