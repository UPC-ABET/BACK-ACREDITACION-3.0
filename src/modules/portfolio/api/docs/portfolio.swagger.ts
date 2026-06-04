import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { portfolioRoutes } from '../../config/portfolio.routes';
import {
	CreatePortfolioProjectDto,
	UpdatePortfolioProjectDto,
	UpdatePortfolioManagerDto,
	GetAllPortfolioDto,
	AutoAssignPartnerDto,
	ManagementAssignDto,
	MigratePortfolioProjectsDto,
	CreateCompanyDto,
	CreateResearchLineDto,
} from '../../model/portfolio.dtos';

const cfg = portfolioRoutes.portfolio;

export const SwaggerPortfolioController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

// ── CRUD ─────────────────────────────────────────────────────────────────────

export const SwaggerPortfolioCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreatePortfolioProjectDto });

export const SwaggerPortfolioUpdate = () =>
	HttpMethodWithSwagger({
		...cfg.operation.update,
		param: { name: 'id', type: Number, description: 'Project ID' },
		body: UpdatePortfolioProjectDto,
	});

export const SwaggerPortfolioUpdateManager = () =>
	HttpMethodWithSwagger({
		...cfg.operation.updateManager,
		param: { name: 'id', type: Number, description: 'Project ID' },
		body: UpdatePortfolioManagerDto,
	});

export const SwaggerPortfolioDelete = () =>
	HttpMethodWithSwagger({
		...cfg.operation.delete,
		param: { name: 'id', type: Number, description: 'Project ID' },
	});

export const SwaggerPortfolioGetAll = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getAll, body: GetAllPortfolioDto });

export const SwaggerPortfolioGetById = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getById,
		param: { name: 'id', type: Number, description: 'Project ID' },
	});

// ── Students ──────────────────────────────────────────────────────────────────

export const SwaggerPortfolioUnassignStudent = () =>
	HttpMethodWithSwagger({
		...cfg.operation.unassignStudent,
		params: [
			{ name: 'projectId', description: 'Project ID', type: Number },
			{ name: 'studentId', description: 'Student ID', type: Number },
		],
	});

export const SwaggerPortfolioAutoAssignPartner = () =>
	HttpMethodWithSwagger({ ...cfg.operation.autoAssignPartner, body: AutoAssignPartnerDto });

export const SwaggerPortfolioManagementAssign = () =>
	HttpMethodWithSwagger({ ...cfg.operation.managementAssign, body: ManagementAssignDto });

// ── Migration ─────────────────────────────────────────────────────────────────

export const SwaggerPortfolioMigrate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.migrate, body: MigratePortfolioProjectsDto });

// ── Teachers ──────────────────────────────────────────────────────────────────

export const SwaggerPortfolioGetTeachersByModality = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getTeachersByModality,
		param: { name: 'modalityTypeId', type: Number, description: 'Modality type ID' },
	});

export const SwaggerPortfolioGetTeacherTotalProjects = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getTeacherTotalProjects,
		param: { name: 'professorId', type: Number, description: 'Professor ID' },
	});

// ── Companies ─────────────────────────────────────────────────────────────────

export const SwaggerPortfolioGetCompanies = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getCompanies });

export const SwaggerPortfolioCreateCompany = () =>
	HttpMethodWithSwagger({ ...cfg.operation.createCompany, body: CreateCompanyDto });

// ── Research lines ────────────────────────────────────────────────────────────

export const SwaggerPortfolioGetResearchLines = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getResearchLines });

export const SwaggerPortfolioCreateResearchLine = () =>
	HttpMethodWithSwagger({ ...cfg.operation.createResearchLine, body: CreateResearchLineDto });

// ── Applications ──────────────────────────────────────────────────────────────

export const SwaggerPortfolioGetApplicationsByProject = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getApplicationsByProject,
		param: { name: 'projectId', type: Number, description: 'Project ID' },
	});

export const SwaggerPortfolioCreateApplication = () =>
	HttpMethodWithSwagger({
		...cfg.operation.createApplication,
		params: [
			{ name: 'projectId', description: 'Project ID', type: Number },
			{ name: 'studentId', description: 'Student ID', type: Number },
		],
	});

export const SwaggerPortfolioDeleteApplication = () =>
	HttpMethodWithSwagger({
		...cfg.operation.deleteApplication,
		param: { name: 'applicationId', type: Number, description: 'Application ID' },
	});

// ── Bulk upload ───────────────────────────────────────────────────────────────

export const SwaggerPortfolioGetBulkUploadTemplate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getBulkUploadTemplate });

export const SwaggerPortfolioDownloadBulkUploadTemplate = () =>
	HttpMethodWithSwagger({
		...cfg.operation.downloadBulkUploadTemplate,
		produces: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	});

export const SwaggerPortfolioDownloadBulkUploadFilledTemplate = () =>
	HttpMethodWithSwagger({
		...cfg.operation.downloadBulkUploadFilledTemplate,
		produces: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	});

export const SwaggerPortfolioBulkUpload = () =>
	HttpMethodWithSwagger({
		...cfg.operation.bulkUpload,
		params: [
			{ name: 'academicPeriodId', description: 'Academic period ID', type: Number },
			{ name: 'modalityTypeId', description: 'Modality type ID', type: Number },
		],
	});

export const SwaggerPortfolioBulkUploadFilled = () =>
	HttpMethodWithSwagger({
		...cfg.operation.bulkUploadFilled,
		params: [
			{ name: 'academicPeriodId', description: 'Academic period ID', type: Number },
			{ name: 'modalityTypeId', description: 'Modality type ID', type: Number },
			{ name: 'courseSectionId', description: 'Course section ID', type: Number },
		],
	});

// ── Export ────────────────────────────────────────────────────────────────────

export const SwaggerPortfolioExport = () =>
	HttpMethodWithSwagger({
		...cfg.operation.export,
		body: GetAllPortfolioDto,
		produces: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	});
