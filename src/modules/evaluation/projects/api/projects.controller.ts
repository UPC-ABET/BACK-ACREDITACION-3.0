import { Body, Param, Post, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { BaseController } from 'src/commons/base.controller';
import { parseSuccessResponse } from 'src/libs/global.functions';
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
import { CreateProjectDto, UpdateProjectDto, FilterProjectDto, ProjectEvaluatorResponseDto, ProjectDetailsResponseDto } from '../model/projects.dtos';

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
		return parseSuccessResponse(await this.projectConfigService.createProject(dto));
	}

	@Get('professor/:professorId')
	@ApiOkResponse({ type: [ProjectEvaluatorResponseDto] })
	async getProjectsByProfessor(@Param('professorId', ParseIntPipe) professorId: number) {
		return parseSuccessResponse(await this.projectConfigService.getProjectsByProfessor(professorId));
	}

	@Get('project/:projectId')
	@ApiOkResponse({ type: ProjectDetailsResponseDto })
	@ApiQuery({ name: 'is_evaluation_mode', required: false, type: Boolean })
	async getProjectWithDetails(
		@Param('projectId', ParseIntPipe) projectId: number,
		@Query('is_evaluation_mode') isEvaluationMode?: string,
	) {
		const isEvalMode = isEvaluationMode === 'true';
		return parseSuccessResponse(
			await this.projectConfigService.getProjectWithDetails(projectId, isEvalMode)
		);
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
