import { Body, HttpStatus, Param, Post, Get, ParseIntPipe, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerProjectController()
export class ProjectController extends BaseController<ProjectService> {
	constructor(
		private readonly service: ProjectService,
		private readonly projectConfigService: ProjectConfigService,
	) {
		super(service);
	}

	@Post('create-full')
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
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
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
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

	@Get('evaluator/:evaluatorId')
	@ApiOkResponse({ type: [ProjectEvaluatorResponseDto] })
	@ApiQuery({ name: 'academicPeriodId', required: false, type: Number })
	@ApiQuery({ name: 'schoolId', required: false, type: Number })
	@ApiQuery({ name: 'gradeTypeCode', required: false, type: String })
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getProjectsByEvaluatorId(
		@Param('evaluatorId', ParseIntPipe) evaluatorId: number,
		@Query('academicPeriodId') academicPeriodId?: string,
		@Query('schoolId') schoolId?: string,
		@Query('gradeTypeCode') gradeTypeCode?: string,
	) {
		const parsedAcademicPeriodId = academicPeriodId ? parseInt(academicPeriodId, 10) : undefined;
		const parsedSchoolId = schoolId ? parseInt(schoolId, 10) : undefined;

		return parseSuccessResponse(
			await this.projectConfigService.getProjectsByProfessor(
				evaluatorId,
				parsedAcademicPeriodId,
				parsedSchoolId,
				gradeTypeCode,
			),
		);
	}

	@Get('project/:projectId')
	@ApiOkResponse({ type: ProjectDetailsResponseDto })
	@ApiQuery({ name: 'isEvaluationMode', required: false, type: Boolean })
	@ApiQuery({ name: 'gradeTypeCode', required: false, type: String })
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getProjectWithDetails(
		@Param('projectId', ParseIntPipe) projectId: number,
		@Query('isEvaluationMode') isEvaluationMode?: string,
		@Query('gradeTypeCode') gradeTypeCode?: string,
		@Query('rubricTypeId', new ParseIntPipe({ optional: true })) rubricTypeId?: number,
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
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateProjectDto) {
		return await super.create(dto);
	}

	@SwaggerProjectUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.PATCH })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectDto) {
		return await super.update(id, dto);
	}

	@SwaggerProjectDelete()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerProjectGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerProjectGetById()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerProjectGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterProjectDto) {
		return await super.getByFilters(dto);
	}

	@Get('export/grades')
	@ApiQuery({ name: 'academicPeriodId', required: true, type: Number })
	@ApiQuery({ name: 'schoolId', required: true, type: Number })
	@ApiQuery({ name: 'gradeTypeCode', required: true, type: String })
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async exportGrades(
		@Query('academicPeriodId', ParseIntPipe) academicPeriodId: number,
		@Query('schoolId', ParseIntPipe) schoolId: number,
		@Query('gradeTypeCode') gradeTypeCode: string,
		@Res() res: Response,
	) {
		const xlsx = await this.projectConfigService.exportProjectGrades(
			academicPeriodId,
			schoolId,
			gradeTypeCode,
		);
		const filename = `notas-proyectos-periodo${academicPeriodId}-escuela${schoolId}.xlsx`;
		const encoded = encodeURIComponent(filename);
		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${filename}"; filename*=UTF-8''${encoded}`,
		);
		res.setHeader('Content-Length', xlsx.length.toString());
		res.end(xlsx);
	}
}
