import { Body, Param, Post, ParseIntPipe } from '@nestjs/common';
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
} from './docs/courses.swagger';
import { CourseService } from './courses.service';
import {
	CreateCourseDto,
	UpdateCourseDto,
	FilterCourseDto,
	FilterCourseEnrolledStudentsDto,
	CourseEnrolledStudentDto,
} from '../model/courses.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerCourseController()
export class CourseController extends BaseController<CourseService> {
	constructor(private readonly service: CourseService) {
		super(service);
	}

	@SwaggerCourseCreate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async create(@Body() dto: CreateCourseDto) {
		return await super.create(dto);
	}

	@SwaggerCourseUpdate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseDto) {
		return await super.update(id, dto);
	}

	@SwaggerCourseDelete()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerCourseGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCourseGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerCourseGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterCourseDto) {
		return await super.getByFilters(dto);
	}

	@Post(':courseId/enrolled-students')
	@ApiOkResponse({ type: [CourseEnrolledStudentDto] })
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getEnrolledStudents(
		@Param('courseId', ParseIntPipe) courseId: number,
		@Body() filters?: FilterCourseEnrolledStudentsDto,
	) {
		return parseSuccessResponse(
			await this.service.getEnrolledStudentsByCourseId(courseId, filters),
		);
	}
}
