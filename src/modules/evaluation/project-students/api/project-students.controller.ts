import { Body, Param } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerProjectStudentController,
	SwaggerProjectStudentCreate,
	SwaggerProjectStudentUpdate,
	SwaggerProjectStudentDelete,
	SwaggerProjectStudentGetAll,
	SwaggerProjectStudentGetById,
	SwaggerProjectStudentGetByFilters,
} from './docs/project-students.swagger';
import { ProjectStudentService } from './project-students.service';
import {
	CreateProjectStudentDto,
	UpdateProjectStudentDto,
	FilterProjectStudentDto,
} from '../model/project-students.dtos';

@SwaggerProjectStudentController()
export class ProjectStudentController extends BaseController<ProjectStudentService> {
	constructor(private readonly service: ProjectStudentService) {
		super(service);
	}

	@SwaggerProjectStudentCreate()
	async create(@Body() dto: CreateProjectStudentDto) {
		return await super.create(dto);
	}

	@SwaggerProjectStudentUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateProjectStudentDto) {
		return await super.update(id, dto);
	}

	@SwaggerProjectStudentDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerProjectStudentGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProjectStudentGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerProjectStudentGetByFilters()
	async getByFilters(@Body() dto: FilterProjectStudentDto) {
		return await super.getByFilters(dto);
	}
}
