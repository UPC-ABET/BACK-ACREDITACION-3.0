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

@SwaggerCourseController()
export class CourseController extends BaseController<CourseService> {
	constructor(private readonly service: CourseService) {
		super(service);
	}

	@SwaggerCourseCreate()
	async create(@Body() dto: CreateCourseDto) {
		return await super.create(dto);
	}

	@SwaggerCourseUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseDto) {
		return await super.update(id, dto);
	}

	@SwaggerCourseDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerCourseGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCourseGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerCourseGetByFilters()
	async getByFilters(@Body() dto: FilterCourseDto) {
		return await super.getByFilters(dto);
	}

	@Post(':courseId/enrolled-students')
	@ApiOkResponse({ type: [CourseEnrolledStudentDto] })
	async getEnrolledStudents(
		@Param('courseId', ParseIntPipe) courseId: number,
		@Body() filters?: FilterCourseEnrolledStudentsDto,
	) {
		return parseSuccessResponse(
			await this.service.getEnrolledStudentsByCourseId(courseId, filters),
		);
	}
}
