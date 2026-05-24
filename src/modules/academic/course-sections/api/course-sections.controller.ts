import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerCourseSectionController,
	SwaggerCourseSectionCreate,
	SwaggerCourseSectionUpdate,
	SwaggerCourseSectionDelete,
	SwaggerCourseSectionGetAll,
	SwaggerCourseSectionGetById,
	SwaggerCourseSectionGetByFilters,
} from './docs/course-sections.swagger';
import { CourseSectionService } from './course-sections.service';
import {
	CreateCourseSectionDto,
	UpdateCourseSectionDto,
	FilterCourseSectionDto,
} from '../model/course-sections.dtos';

@SwaggerCourseSectionController()
export class CourseSectionController extends BaseController<CourseSectionService> {
	constructor(private readonly service: CourseSectionService) {
		super(service);
	}

	@SwaggerCourseSectionCreate()
	async create(@Body() dto: CreateCourseSectionDto) {
		return await super.create(dto);
	}

	@SwaggerCourseSectionUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseSectionDto) {
		return await super.update(id, dto);
	}

	@SwaggerCourseSectionDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerCourseSectionGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCourseSectionGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerCourseSectionGetByFilters()
	async getByFilters(@Body() dto: FilterCourseSectionDto) {
		return await super.getByFilters(dto);
	}
}
