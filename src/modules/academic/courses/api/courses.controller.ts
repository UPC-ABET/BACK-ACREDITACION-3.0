import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { SwaggerCourseController, SwaggerCourseCreate, SwaggerCourseUpdate, SwaggerCourseDelete, SwaggerCourseGetAll, SwaggerCourseGetById, SwaggerCourseGetByFilters } from './docs/courses.swagger';
import { CourseService } from './courses.service';
import { CreateCourseDto, UpdateCourseDto, FilterCourseDto } from '../model/courses.dtos';

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
	async update(@Param('id') id: number, @Body() dto: UpdateCourseDto) {
		return await super.update(id, dto);
	}

	@SwaggerCourseDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerCourseGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCourseGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerCourseGetByFilters()
	async getByFilters(@Body() dto: FilterCourseDto) {
		return await super.getByFilters(dto);
	}
}
