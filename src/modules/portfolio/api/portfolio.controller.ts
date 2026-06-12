import {
	Body,
	Param,
	ParseIntPipe,
	Query,
	Res,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { BaseController } from 'src/commons/base.controller';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { PortfolioService } from './portfolio.service';
import {
	AutoAssignPartnerDto,
	CreateCompanyDto,
	CreatePortfolioProjectDto,
	CreateResearchLineDto,
	GetAllPortfolioDto,
	ManagementAssignDto,
	MigratePortfolioProjectsDto,
	UpdatePortfolioManagerDto,
	UpdatePortfolioProjectDto,
} from '../model/portfolio.dtos';
import {
	SwaggerPortfolioAutoAssignPartner,
	SwaggerPortfolioBulkUpload,
	SwaggerPortfolioBulkUploadFilled,
	SwaggerPortfolioController,
	SwaggerPortfolioCreate,
	SwaggerPortfolioCreateApplication,
	SwaggerPortfolioCreateCompany,
	SwaggerPortfolioCreateResearchLine,
	SwaggerPortfolioDelete,
	SwaggerPortfolioDeleteApplication,
	SwaggerPortfolioDownloadBulkUploadFilledTemplate,
	SwaggerPortfolioDownloadBulkUploadTemplate,
	SwaggerPortfolioExport,
	SwaggerPortfolioGetAll,
	SwaggerPortfolioGetApplicationsByProject,
	SwaggerPortfolioGetById,
	SwaggerPortfolioGetBulkUploadTemplate,
	SwaggerPortfolioGetCompanies,
	SwaggerPortfolioGetResearchLines,
	SwaggerPortfolioGetTeachersByModality,
	SwaggerPortfolioGetTeacherTotalProjects,
	SwaggerPortfolioManagementAssign,
	SwaggerPortfolioMigrate,
	SwaggerPortfolioUnassignStudent,
	SwaggerPortfolioUpdate,
	SwaggerPortfolioUpdateManager,
} from './docs/portfolio.swagger';

@SwaggerPortfolioController()
export class PortfolioController extends BaseController<PortfolioService> {
	constructor(private readonly service: PortfolioService) {
		super(service);
	}

	// ── CRUD ──────────────────────────────────────────────────────────────────

	@SwaggerPortfolioCreate()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreatePortfolioProjectDto) {
		return parseSuccessResponse(await this.service.createProject(dto));
	}

	@SwaggerPortfolioUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePortfolioProjectDto) {
		return parseSuccessResponse(await this.service.updateProject(id, dto));
	}

	@SwaggerPortfolioUpdateManager()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.PUT })
	async updateManager(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdatePortfolioManagerDto,
	) {
		return parseSuccessResponse(await this.service.updateProjectManager(id, dto));
	}

	@SwaggerPortfolioDelete()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.deleteProject(id));
	}

	@SwaggerPortfolioGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.GET })
	async getAllProjects(@Body() dto: GetAllPortfolioDto) {
		return parseSuccessResponse(await this.service.getAllWithFilters(dto.body, dto.page));
	}

	@SwaggerPortfolioGetById()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.getProjectById(id));
	}

	// ── Students ──────────────────────────────────────────────────────────────

	@SwaggerPortfolioUnassignStudent()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.DELETE })
	async unassignStudent(
		@Param('projectId', ParseIntPipe) projectId: number,
		@Param('studentId', ParseIntPipe) studentId: number,
	) {
		return parseSuccessResponse(await this.service.unassignStudent(projectId, studentId));
	}

	@SwaggerPortfolioAutoAssignPartner()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.POST })
	async autoAssignPartner(@Body() dto: AutoAssignPartnerDto) {
		return parseSuccessResponse(await this.service.autoAssignPartner(dto));
	}

	@SwaggerPortfolioManagementAssign()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.POST })
	async managementAssign(@Body() dto: ManagementAssignDto) {
		return parseSuccessResponse(await this.service.managementAssign(dto));
	}

	// ── Migration ─────────────────────────────────────────────────────────────

	@SwaggerPortfolioMigrate()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.PUT })
	async migrate(@Body() dto: MigratePortfolioProjectsDto) {
		return parseSuccessResponse(await this.service.migrateProjects(dto));
	}

	// ── Teachers ──────────────────────────────────────────────────────────────

	@SwaggerPortfolioGetTeachersByModality()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.GET })
	async getTeachersByModality(@Param('modalityTypeId', ParseIntPipe) modalityTypeId: number) {
		return parseSuccessResponse(await this.service.getTeachersByModality(modalityTypeId));
	}

	@SwaggerPortfolioGetTeacherTotalProjects()
	@ApiQuery({ name: 'modalityTypeId', required: false, type: Number })
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.GET })
	async getTeacherTotalProjects(
		@Param('professorId', ParseIntPipe) professorId: number,
		@Query('modalityTypeId', new ParseIntPipe({ optional: true })) modalityTypeId?: number,
	) {
		return parseSuccessResponse(
			await this.service.getTotalTeacherProjects(professorId, modalityTypeId),
		);
	}

	// ── Companies ─────────────────────────────────────────────────────────────

	@SwaggerPortfolioGetCompanies()
	@ApiQuery({ name: 'academicPeriodId', required: true, type: Number })
	@ApiQuery({ name: 'modalityTypeId', required: true, type: Number })
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.GET })
	async getCompanies(
		@Query('academicPeriodId', ParseIntPipe) academicPeriodId: number,
		@Query('modalityTypeId', ParseIntPipe) modalityTypeId: number,
	) {
		return parseSuccessResponse(
			await this.service.getCompaniesByPeriodAndModality(academicPeriodId, modalityTypeId),
		);
	}

	@SwaggerPortfolioCreateCompany()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.POST })
	async createCompany(@Body() dto: CreateCompanyDto) {
		return parseSuccessResponse(await this.service.createCompany(dto));
	}

	// ── Research lines ────────────────────────────────────────────────────────

	@SwaggerPortfolioGetResearchLines()
	@ApiQuery({ name: 'programId', required: false, type: Number })
	@ApiQuery({ name: 'modalityTypeId', required: false, type: Number })
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.GET })
	async getResearchLines(
		@Query('programId', new ParseIntPipe({ optional: true })) programId?: number,
		@Query('modalityTypeId', new ParseIntPipe({ optional: true })) modalityTypeId?: number,
	) {
		return parseSuccessResponse(await this.service.getResearchLines(programId, modalityTypeId));
	}

	@SwaggerPortfolioCreateResearchLine()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.POST })
	async createResearchLine(@Body() dto: CreateResearchLineDto) {
		return parseSuccessResponse(await this.service.createResearchLine(dto));
	}

	// ── Applications ──────────────────────────────────────────────────────────

	@SwaggerPortfolioGetApplicationsByProject()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.GET })
	async getApplicationsByProject(@Param('projectId', ParseIntPipe) projectId: number) {
		return parseSuccessResponse(await this.service.getApplicationsByProject(projectId));
	}

	@SwaggerPortfolioCreateApplication()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.POST })
	async createApplication(
		@Param('projectId', ParseIntPipe) projectId: number,
		@Param('studentId', ParseIntPipe) studentId: number,
	) {
		return parseSuccessResponse(await this.service.createApplication(projectId, studentId));
	}

	@SwaggerPortfolioDeleteApplication()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.DELETE })
	async deleteApplication(@Param('applicationId', ParseIntPipe) applicationId: number) {
		return parseSuccessResponse(await this.service.deleteApplication(applicationId));
	}

	// ── Bulk upload ───────────────────────────────────────────────────────────

	@SwaggerPortfolioGetBulkUploadTemplate()
	async getBulkUploadTemplate() {
		const { bytes, fileName } = await this.service.generateBulkUploadTemplate();
		return { success: true, resource: { bytes: bytes.toString('base64'), fileName } };
	}

	@SwaggerPortfolioDownloadBulkUploadTemplate()
	async downloadBulkUploadTemplate(@Res() res: Response) {
		const { bytes, fileName } = await this.service.generateBulkUploadTemplate();
		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		);
		res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
		res.send(bytes);
	}

	@SwaggerPortfolioDownloadBulkUploadFilledTemplate()
	async downloadBulkUploadFilledTemplate(@Res() res: Response) {
		const { bytes, fileName } = await this.service.generateBulkUploadFilledTemplate();
		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		);
		res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
		res.send(bytes);
	}

	@SwaggerPortfolioBulkUpload()
	@ApiConsumes('multipart/form-data')
	@UseInterceptors(FileInterceptor('file'))
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.POST })
	async bulkUpload(
		@Param('academicPeriodId', ParseIntPipe) academicPeriodId: number,
		@Param('modalityTypeId', ParseIntPipe) modalityTypeId: number,
		@UploadedFile() file: Express.Multer.File,
	) {
		return parseSuccessResponse(
			await this.service.bulkUpload(academicPeriodId, modalityTypeId, file),
		);
	}

	@SwaggerPortfolioBulkUploadFilled()
	@ApiConsumes('multipart/form-data')
	@UseInterceptors(FileInterceptor('file'))
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.POST })
	async bulkUploadFilled(
		@Param('academicPeriodId', ParseIntPipe) academicPeriodId: number,
		@Param('modalityTypeId', ParseIntPipe) modalityTypeId: number,
		@Param('courseSectionId', ParseIntPipe) courseSectionId: number,
		@UploadedFile() file: Express.Multer.File,
	) {
		return parseSuccessResponse(
			await this.service.bulkUploadFilled(academicPeriodId, modalityTypeId, courseSectionId, file),
		);
	}

	// ── Export ────────────────────────────────────────────────────────────────

	@SwaggerPortfolioExport()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.POST })
	async export(@Body() dto: GetAllPortfolioDto, @Res() res: Response) {
		const { bytes, fileName } = await this.service.exportToExcel(dto.body);
		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		);
		res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
		res.send(bytes);
	}
}
