import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudyPlanCourseController,
	SwaggerStudyPlanCourseCreate,
	SwaggerStudyPlanCourseUpdate,
	SwaggerStudyPlanCourseDelete,
	SwaggerStudyPlanCourseGetAll,
	SwaggerStudyPlanCourseGetById,
	SwaggerStudyPlanCourseGetByFilters,
} from './docs/study-plan-courses.swagger';
import { StudyPlanCourseService } from './study-plan-courses.service';
import {
	CreateStudyPlanCourseDto,
	UpdateStudyPlanCourseDto,
	FilterStudyPlanCourseDto,
} from '../model/study-plan-courses.dtos';

@SwaggerStudyPlanCourseController()
export class StudyPlanCourseController extends BaseController<StudyPlanCourseService> {
	constructor(private readonly service: StudyPlanCourseService) {
		super(service);
	}

	@SwaggerStudyPlanCourseCreate()
	async create(@Body() dto: CreateStudyPlanCourseDto) {
		return await super.create(dto);
	}

	@SwaggerStudyPlanCourseUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateStudyPlanCourseDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudyPlanCourseDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerStudyPlanCourseGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudyPlanCourseGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerStudyPlanCourseGetByFilters()
	async getByFilters(@Body() dto: FilterStudyPlanCourseDto) {
		return await super.getByFilters(dto);
	}
}
