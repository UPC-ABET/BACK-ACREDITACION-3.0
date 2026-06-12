import { Body, Param, Post, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerCourseController,
	SwaggerCourseCreate,
	SwaggerCourseUpdate,
	SwaggerCourseDelete,
	SwaggerCourseGetAll,
	SwaggerCourseGetById,
	SwaggerCourseGetByFilters,
	SwaggerCourseLookup,
} from './docs/courses.swagger';
import { CourseService } from './courses.service';
import {
	CreateCourseDto,
	UpdateCourseDto,
	FilterCourseDto,
	FilterCourseEnrolledStudentsDto,
	CourseEnrolledStudentDto,
} from '../model/courses.dtos';
import { LookupQueryDto } from 'src/commons/lookup.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerCourseController()
export class CourseController extends BaseController<CourseService> {
	constructor(private readonly service: CourseService) {
		super(service);
	}

	@SwaggerCourseCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateCourseDto) {
		return await super.create(dto);
	}

	@SwaggerCourseUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseDto) {
		return await super.update(id, dto);
	}

	@SwaggerCourseDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerCourseGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCourseGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerCourseGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterCourseDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerCourseLookup()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async lookup(@Query() query: LookupQueryDto) {
		return parseSuccessResponse(await this.service.getLookup(query));
	}

	@Post(':courseId/enrolled-students')
	@ApiOkResponse({ type: [CourseEnrolledStudentDto] })
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getEnrolledStudents(
		@Param('courseId', ParseIntPipe) courseId: number,
		@Body() filters?: FilterCourseEnrolledStudentsDto,
	) {
		return parseSuccessResponse(
			await this.service.getEnrolledStudentsByCourseId(courseId, filters),
		);
	}
}
