import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerCourseOutcomeMappingController,
	SwaggerCourseOutcomeMappingCreate,
	SwaggerCourseOutcomeMappingUpdate,
	SwaggerCourseOutcomeMappingDelete,
	SwaggerCourseOutcomeMappingGetAll,
	SwaggerCourseOutcomeMappingGetById,
	SwaggerCourseOutcomeMappingGetByFilters,
} from './docs/course-outcome-mappings.swagger';
import { CourseOutcomeMappingService } from './course-outcome-mappings.service';
import {
	CreateCourseOutcomeMappingDto,
	UpdateCourseOutcomeMappingDto,
	FilterCourseOutcomeMappingDto,
} from '../model/course-outcome-mappings.dtos';

@SwaggerCourseOutcomeMappingController()
export class CourseOutcomeMappingController extends BaseController<CourseOutcomeMappingService> {
	constructor(private readonly service: CourseOutcomeMappingService) {
		super(service);
	}

	@SwaggerCourseOutcomeMappingCreate()
	async create(@Body() dto: CreateCourseOutcomeMappingDto) {
		return await super.create(dto);
	}

	@SwaggerCourseOutcomeMappingUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseOutcomeMappingDto) {
		return await super.update(id, dto);
	}

	@SwaggerCourseOutcomeMappingDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerCourseOutcomeMappingGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCourseOutcomeMappingGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerCourseOutcomeMappingGetByFilters()
	async getByFilters(@Body() dto: FilterCourseOutcomeMappingDto) {
		return await super.getByFilters(dto);
	}
}
