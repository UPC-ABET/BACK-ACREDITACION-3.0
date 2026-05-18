import { Body, Param, Query, UploadedFile, UseInterceptors, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { ProjectPortfolioService } from './project-portfolios.service';
import {
	SwaggerProjectPortfolioController,
	SwaggerProjectPortfolioGetModalities,
	SwaggerProjectPortfolioGetCareers,
	SwaggerProjectPortfolioGetAccess,
	SwaggerProjectPortfolioListRoles,
	SwaggerProjectPortfolioGetAllPaginated,
	SwaggerProjectPortfolioGetById,
	SwaggerProjectPortfolioCreate,
	SwaggerProjectPortfolioUpdate,
	SwaggerProjectPortfolioDelete,
	SwaggerProjectPortfolioGetBulkUploadTemplate,
	SwaggerProjectPortfolioGetBulkUploadTemplateFile,
	SwaggerProjectPortfolioBulkUpload,
	SwaggerProjectPortfolioBulkUploadFilled,
	SwaggerProjectPortfolioGetCompanies,
	SwaggerProjectPortfolioUnassignStudent,
	SwaggerProjectPortfolioGetTotalTeacherProjects,
	SwaggerProjectPortfolioUpdateManager,
	SwaggerProjectPortfolioAutoAssignPartner,
	SwaggerProjectPortfolioExport,
	SwaggerProjectPortfolioGetTeachers,
	SwaggerProjectPortfolioMigrate,
	SwaggerProjectPortfolioManagementAssign,
	SwaggerProjectPortfolioMigrateFromDatabase,
} from './docs/project-portfolios.swagger';
import {
	CreateProjectPortfolioDto,
	UpdateProjectPortfolioDto,
	UpdateProjectPortfolioManagerDto,
	PaginatedProjectPortfolioRequestDto,
	MigrateProjectPortfoliosDto,
	MigrateFromDatabaseDto,
	ManagementAssignDto,
	AutoAssignPartnerDto,
} from '../model/project-portfolios.dtos';

@SwaggerProjectPortfolioController()
export class ProjectPortfolioController {
	constructor(private readonly service: ProjectPortfolioService) {}

	// %% =====================================================================
	// %%  CATÁLOGOS
	// %% =====================================================================
	@SwaggerProjectPortfolioGetModalities()
	async getModalities(@Query('college') college: string, @Query('idUsuario') idUsuario: number) {
		return parseSuccessResponse(await this.service.getModalities(college, Number(idUsuario)));
	}

	@SwaggerProjectPortfolioGetCareers()
	async getCareers(@Query('college') college: string, @Query('escuelaId') escuelaId: number) {
		return parseSuccessResponse(await this.service.getCareers(college, Number(escuelaId)));
	}

	@SwaggerProjectPortfolioGetAccess()
	async getAccess(@Query('college') college: string, @Query('idUsuario') idUsuario: number, @Query('idModalidad') idModalidad: number) {
		return parseSuccessResponse(await this.service.getAccess(college, Number(idUsuario), Number(idModalidad)));
	}

	@SwaggerProjectPortfolioListRoles()
	async listRoles(@Query('idUsuario') idUsuario: number, @Query('escuela') escuela: string, @Query('escuelaUsuario') escuelaUsuario: string) {
		return parseSuccessResponse(await this.service.listRoles(escuela, Number(idUsuario), escuelaUsuario));
	}

	// %% =====================================================================
	// %%  CRUD
	// %% =====================================================================
	@SwaggerProjectPortfolioGetAllPaginated()
	async getAllPaginated(@Body() paginator: PaginatedProjectPortfolioRequestDto) {
		return parseSuccessResponse(await this.service.getAllPaginated(paginator));
	}

	@SwaggerProjectPortfolioGetById()
	async getById(@Param('id') id: number, @Query('college') college: string) {
		return parseSuccessResponse(await this.service.getByIdPortfolio(Number(id), college));
	}

	@SwaggerProjectPortfolioCreate()
	async create(@Body() dto: CreateProjectPortfolioDto, @Query('college') college: string) {
		return parseSuccessResponse(await this.service.createPortfolio(dto, college));
	}

	@SwaggerProjectPortfolioUpdate()
	async update(@Body() dto: UpdateProjectPortfolioDto, @Query('college') college: string) {
		return parseSuccessResponse(await this.service.updatePortfolio(dto, college));
	}

	@SwaggerProjectPortfolioDelete()
	async delete(@Param('id') id: number, @Query('college') college: string) {
		return parseSuccessResponse(await this.service.deletePortfolio(Number(id), college));
	}

	// %% =====================================================================
	// %%  PLANTILLAS / BULK
	// %% =====================================================================
	@SwaggerProjectPortfolioGetBulkUploadTemplate()
	async getBulkUploadTemplate() {
		const r = await this.service.getBulkUploadTemplate();
		return parseSuccessResponse({ NombreArchivo: r.NombreArchivo, Headers: r.Headers });
	}

	@SwaggerProjectPortfolioGetBulkUploadTemplateFile()
	async getBulkUploadTemplateFile(@Res() res: Response) {
		const r = await this.service.getBulkUploadTemplateFile();
		res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
		res.setHeader('Content-Disposition', `attachment; filename="${r.NombreArchivo}"`);
		return res.send(r.Bytes);
	}

	@SwaggerProjectPortfolioBulkUpload()
	@UseInterceptors(FileInterceptor('file'))
	async bulkUpload(
		@Param('periodoAcademicoId') periodoAcademicoId: number,
		@Param('college') college: string,
		@Param('IdModalidad') idModalidad: number,
		@UploadedFile() file: any,
	) {
		return parseSuccessResponse(await this.service.bulkUpload(college, Number(periodoAcademicoId), Number(idModalidad), file));
	}

	@SwaggerProjectPortfolioBulkUploadFilled()
	@UseInterceptors(FileInterceptor('file'))
	async bulkUploadFilled(
		@Param('college') college: string,
		@Param('periodoAcademicoId') periodoAcademicoId: number,
		@Param('IdModalidad') idModalidad: number,
		@Param('courseCode') courseCode: string,
		@UploadedFile() file: any,
	) {
		return parseSuccessResponse(await this.service.bulkUploadFilled(college, Number(periodoAcademicoId), Number(idModalidad), courseCode, file));
	}

	// %% =====================================================================
	// %%  EMPRESAS / DOCENTES
	// %% =====================================================================
	@SwaggerProjectPortfolioGetCompanies()
	async getCompanies(@Param('academicPeriodId') academicPeriodId: number, @Param('modalityId') modalityId: number, @Query('college') college: string) {
		return parseSuccessResponse(await this.service.getCompanies(college, Number(academicPeriodId), Number(modalityId)));
	}

	@SwaggerProjectPortfolioGetTeachers()
	async getTeachers(@Param('modalityId') modalityId: number, @Query('college') college: string) {
		return parseSuccessResponse(await this.service.getTeachers(college, Number(modalityId)));
	}

	@SwaggerProjectPortfolioGetTotalTeacherProjects()
	async getTotalTeacherProjects(@Param('teacherId') teacherId: number, @Query('college') college: string) {
		return parseSuccessResponse(await this.service.getTotalTeacherProjects(college, Number(teacherId)));
	}

	// %% =====================================================================
	// %%  ASIGNACIONES
	// %% =====================================================================
	@SwaggerProjectPortfolioUnassignStudent()
	async unassignStudent(@Param('projectPortfolioId') projectPortfolioId: number, @Param('studentId') studentId: number, @Query('college') college: string) {
		return parseSuccessResponse(await this.service.unassignStudent(college, Number(projectPortfolioId), Number(studentId)));
	}

	@SwaggerProjectPortfolioUpdateManager()
	async updateManager(@Body() dto: UpdateProjectPortfolioManagerDto, @Query('college') college: string) {
		return parseSuccessResponse(await this.service.updateManager(college, dto));
	}

	@SwaggerProjectPortfolioAutoAssignPartner()
	async autoAssignPartner(@Body() dto: AutoAssignPartnerDto, @Query('college') college: string) {
		return parseSuccessResponse(await this.service.autoAssignPartner(college, dto));
	}

	@SwaggerProjectPortfolioManagementAssign()
	async managementAssign(@Body() dto: ManagementAssignDto, @Query('college') college: string) {
		return parseSuccessResponse(await this.service.managementAssign(college, dto));
	}

	// %% =====================================================================
	// %%  EXPORT / MIGRACIÓN
	// %% =====================================================================
	@SwaggerProjectPortfolioExport()
	async export(@Body() paginator: PaginatedProjectPortfolioRequestDto) {
		return parseSuccessResponse(await this.service.export(paginator));
	}

	@SwaggerProjectPortfolioMigrate()
	async migrate(@Body() dto: MigrateProjectPortfoliosDto, @Query('college') college: string) {
		return parseSuccessResponse(await this.service.migrate(college, dto));
	}

	@SwaggerProjectPortfolioMigrateFromDatabase()
	async migrateFromDatabase(@Body() dto: MigrateFromDatabaseDto, @Query('college') college: string) {
		return parseSuccessResponse(await this.service.migrateFromDatabase(college, dto));
	}
}
