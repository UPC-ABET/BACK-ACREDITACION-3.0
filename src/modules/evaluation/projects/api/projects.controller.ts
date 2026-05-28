import { Body, HttpStatus, Param, Post, Get, ParseIntPipe, Query } from '@nestjs/common';
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
import {
	CreateProjectDto,
	UpdateProjectDto,
	FilterProjectDto,
	ProjectEvaluatorResponseDto,
	ProjectDetailsResponseDto,
} from '../model/projects.dtos';

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
		return parseSuccessResponse(
			await this.projectConfigService.createProject(dto),
			HttpStatus.CREATED,
		);
	}

	@Get('professor/:professorId')
	@ApiOkResponse({ type: [ProjectEvaluatorResponseDto] })
	@ApiQuery({ name: 'academicPeriodId', required: false, type: Number })
	@ApiQuery({ name: 'schoolId', required: false, type: Number })
	@ApiQuery({ name: 'gradeTypeCode', required: false, type: String })
	async getProjectsByProfessor(
		@Param('professorId', ParseIntPipe) professorId: number,
		@Query('academicPeriodId') academicPeriodId?: string,
		@Query('schoolId') schoolId?: string,
		@Query('gradeTypeCode') gradeTypeCode?: string,
	) {
		const parsedAcademicPeriodId = academicPeriodId ? parseInt(academicPeriodId, 10) : undefined;
		const parsedSchoolId = schoolId ? parseInt(schoolId, 10) : undefined;

		return parseSuccessResponse(
			await this.projectConfigService.getProjectsByProfessor(
				professorId,
				parsedAcademicPeriodId,
				parsedSchoolId,
				gradeTypeCode,
			),
		);
	}

	@Get('project/:projectId')
	@ApiOkResponse({ type: ProjectDetailsResponseDto })
	@ApiQuery({ name: 'is_evaluation_mode', required: false, type: Boolean })
	@ApiQuery({ name: 'grade_type_code', required: false, type: String })
	async getProjectWithDetails(
		@Param('projectId', ParseIntPipe) projectId: number,
		@Query('is_evaluation_mode') isEvaluationMode?: string,
		@Query('grade_type_code') gradeTypeCode?: string,
		@Query('rubric_type_id', new ParseIntPipe({ optional: true })) rubricTypeId?: number,
	) {
		const isEvalMode = isEvaluationMode === 'true';
		return parseSuccessResponse(
			await this.projectConfigService.getProjectWithDetails(
				projectId,
				isEvalMode,
				gradeTypeCode,
				rubricTypeId,
			),
		);
	}

	@SwaggerProjectCreate()
	async create(@Body() dto: CreateProjectDto) {
		return await super.create(dto);
	}

	@SwaggerProjectUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectDto) {
		return await super.update(id, dto);
	}

	@SwaggerProjectDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerProjectGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProjectGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProjectGetByFilters()
	async getByFilters(@Body() dto: FilterProjectDto) {
		return await super.getByFilters(dto);
	}
}
