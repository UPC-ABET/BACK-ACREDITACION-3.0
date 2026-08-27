import { Body, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
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
import {
	SchoolId,
	ApiSchoolHeader,
} from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { ApiTokenAuth } from 'src/modules/auth/protocols/api-key/decorators/api-token-auth.decorator';

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

	// Opted into machine-to-machine access (see docs/POLICIES.md § Auth & Guards): a token scoped
	// to {ACADEMIC, POST} can read course status/outcome/career per academic period. `create` and
	// `maintenanceCreate` below need the same {ACADEMIC, POST} permission but stay JWT-only —
	// `@ApiTokenAuth()` is checked per route by `ApiTokenAuthGuard` before the scope is ever
	// evaluated, so a token is rejected there for any route that doesn't carry this decorator,
	// regardless of what its scopes say.
	@SwaggerStudyPlanCourseGetByFilters()
	@ApiSecurity('apiKey')
	@ApiTokenAuth()
	@ApiSchoolHeader(false)
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(
		@Body() dto: FilterStudyPlanCourseDto,
		@SchoolId({ optional: true }) schoolId?: number | null,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
	) {
		return parseSuccessResponse(
			await this.service.getByFilters({ ...dto, schoolId, academicPeriodId }),
		);
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
