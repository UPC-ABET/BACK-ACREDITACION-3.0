import { Body, Param, Post, Get, ParseIntPipe } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerProjectController,
	SwaggerProjectCreate,
	SwaggerProjectUpdate,
	SwaggerProjectDelete,
	SwaggerProjectGetAll,
	SwaggerProjectGetById,
	SwaggerProjectGetByFilters,
} from './docs/projects.swagger';
import { ProjectService } from './projects.service';
import { ProjectConfigService } from './project-config.service';
import { CreateProjectDto, UpdateProjectDto, FilterProjectDto, ProjectEvaluatorResponseDto } from '../model/projects.dtos';

@SwaggerProjectController()
export class ProjectController extends BaseController<ProjectService> {
	constructor(
		private readonly service: ProjectService,
		private readonly projectConfigService: ProjectConfigService,
	) {
		super(service);
	}

	@Post('create-full')
	async createProjectFull(@Body() dto: CreateProjectDto) {
		return await this.projectConfigService.createProject(dto);
	}

	@Get('evaluator/:evaluatorId')
	@ApiOkResponse({ type: [ProjectEvaluatorResponseDto] })
	async getProjectsByEvaluator(@Param('evaluatorId', ParseIntPipe) evaluatorId: number) {
		return await this.projectConfigService.getProjectsByEvaluator(evaluatorId);
	}

	@Get('project/:projectId')
	async getProjectWithDetails(@Param('projectId', ParseIntPipe) projectId: number) {
		return await this.projectConfigService.getProjectById(projectId);
	}

	@SwaggerProjectCreate()
	async create(@Body() dto: CreateProjectDto) {
		return await super.create(dto);
	}

	@SwaggerProjectUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateProjectDto) {
		return await super.update(id, dto);
	}

	@SwaggerProjectDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerProjectGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProjectGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerProjectGetByFilters()
	async getByFilters(@Body() dto: FilterProjectDto) {
		return await super.getByFilters(dto);
	}
}
