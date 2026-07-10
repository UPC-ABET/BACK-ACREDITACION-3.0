import { Body, Param, Post, Get, ParseIntPipe, Query, ValidationPipe } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerRubricController,
	SwaggerRubricCreate,
	SwaggerRubricUpdate,
	SwaggerRubricDelete,
	SwaggerRubricGetAll,
	SwaggerRubricGetById,
	SwaggerRubricGetByFilters,
} from './docs/rubrics.swagger';
import { RubricService } from './rubrics.service';
import { RubricConfigService } from './rubric-config.service';
import {
	CreateRubricDto,
	UpdateRubricDto,
	FilterRubricDto,
	GetRubricsQueryDto,
} from '../model/rubrics.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	SchoolId,
	ApiSchoolHeader,
} from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerRubricController()
export class RubricController extends BaseController<RubricService> {
	constructor(
		private readonly service: RubricService,
		private readonly rubricConfigService: RubricConfigService,
	) {
		super(service);
	}

	@Post('create-full')
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async createRubricFull(@Body() dto: CreateRubricDto) {
		return await this.rubricConfigService.createRubric(dto);
	}

	@Get('resolve-type')
	@ApiQuery({ name: 'studyPlanCourseId', required: true, type: Number })
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async resolveRubricType(@Query('studyPlanCourseId', ParseIntPipe) studyPlanCourseId: number) {
		return parseSuccessResponse(
			await this.rubricConfigService.resolveRubricType(studyPlanCourseId),
		);
	}

	@Get('course/:courseId')
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getRubricByCourse(@Param('courseId', ParseIntPipe) courseId: number) {
		return await this.rubricConfigService.getRubricByCourse(courseId);
	}

	@Get('rubric/:rubricId')
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getRubricWithDetails(@Param('rubricId', ParseIntPipe) rubricId: number) {
		return await this.rubricConfigService.getRubricById(rubricId);
	}

	@SwaggerRubricCreate()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateRubricDto) {
		return await super.create(dto);
	}

	@SwaggerRubricUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.PATCH })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRubricDto) {
		return await super.update(id, dto);
	}

	@SwaggerRubricDelete()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await this.service.delete(id);
	}

	@SwaggerRubricGetAll()
	@ApiSchoolHeader(false)
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getAll(
		@SchoolId({ optional: true }) schoolId?: number | null,
		@AcademicPeriodId({ optional: true }) academicPeriodId?: number | null,
		@Query(new ValidationPipe({ transform: true, whitelist: true }))
		query: GetRubricsQueryDto = {},
	) {
		return parseSuccessResponse(
			await this.service.getAllWithFilters(
				{
					schoolId: schoolId ?? undefined,
					programId: query.programId,
					academicPeriodId: academicPeriodId ?? undefined,
					courseId: query.courseId,
				},
				query,
			),
		);
	}

	@SwaggerRubricGetById()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerRubricGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterRubricDto) {
		return await super.getByFilters(dto);
	}
}
