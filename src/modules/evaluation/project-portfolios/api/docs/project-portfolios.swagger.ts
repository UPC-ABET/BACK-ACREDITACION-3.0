import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { projectPortfoliosRoutes } from '../../config/project-portfolios.routes';
import {
	CreateProjectPortfolioDto,
	UpdateProjectPortfolioDto,
	UpdateProjectPortfolioManagerDto,
	PaginatedProjectPortfolioRequestDto,
	MigrateProjectPortfoliosDto,
	MigrateFromDatabaseDto,
	ManagementAssignDto,
	AutoAssignPartnerDto,
} from '../../model/project-portfolios.dtos';

const cfg = projectPortfoliosRoutes.projectPortfolios;

export const SwaggerProjectPortfolioController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerProjectPortfolioGetModalities = () => HttpMethodWithSwagger(cfg.operation.getModalities);
export const SwaggerProjectPortfolioGetCareers = () => HttpMethodWithSwagger(cfg.operation.getCareers);
export const SwaggerProjectPortfolioGetAccess = () => HttpMethodWithSwagger(cfg.operation.getAccess);
export const SwaggerProjectPortfolioListRoles = () => HttpMethodWithSwagger(cfg.operation.listRoles);

export const SwaggerProjectPortfolioGetAllPaginated = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getAllPaginated, body: PaginatedProjectPortfolioRequestDto });

export const SwaggerProjectPortfolioGetById = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getById, params: [{ name: 'id', description: 'ID del portafolio', type: Number }] });

export const SwaggerProjectPortfolioCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateProjectPortfolioDto });
export const SwaggerProjectPortfolioUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateProjectPortfolioDto });
export const SwaggerProjectPortfolioDelete = () =>
	HttpMethodWithSwagger({ ...cfg.operation.delete, params: [{ name: 'id', description: 'ID del portafolio', type: Number }] });

export const SwaggerProjectPortfolioGetBulkUploadTemplate = () => HttpMethodWithSwagger(cfg.operation.getBulkUploadTemplate);
export const SwaggerProjectPortfolioGetBulkUploadTemplateFile = () => HttpMethodWithSwagger(cfg.operation.getBulkUploadTemplateFile);
export const SwaggerProjectPortfolioBulkUpload = () => HttpMethodWithSwagger(cfg.operation.bulkUpload);
export const SwaggerProjectPortfolioBulkUploadFilled = () => HttpMethodWithSwagger(cfg.operation.bulkUploadFilled);

export const SwaggerProjectPortfolioGetCompanies = () => HttpMethodWithSwagger(cfg.operation.getCompanies);
export const SwaggerProjectPortfolioUnassignStudent = () => HttpMethodWithSwagger(cfg.operation.unassignStudent);
export const SwaggerProjectPortfolioGetTotalTeacherProjects = () => HttpMethodWithSwagger(cfg.operation.getTotalTeacherProjects);

export const SwaggerProjectPortfolioUpdateManager = () =>
	HttpMethodWithSwagger({ ...cfg.operation.updateManager, body: UpdateProjectPortfolioManagerDto });
export const SwaggerProjectPortfolioAutoAssignPartner = () =>
	HttpMethodWithSwagger({ ...cfg.operation.autoAssignPartner, body: AutoAssignPartnerDto });
export const SwaggerProjectPortfolioExport = () =>
	HttpMethodWithSwagger({ ...cfg.operation.export, body: PaginatedProjectPortfolioRequestDto });
export const SwaggerProjectPortfolioGetTeachers = () => HttpMethodWithSwagger(cfg.operation.getTeachers);
export const SwaggerProjectPortfolioMigrate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.migrate, body: MigrateProjectPortfoliosDto });
export const SwaggerProjectPortfolioManagementAssign = () =>
	HttpMethodWithSwagger({ ...cfg.operation.managementAssign, body: ManagementAssignDto });
export const SwaggerProjectPortfolioMigrateFromDatabase = () =>
	HttpMethodWithSwagger({ ...cfg.operation.migrateFromDatabase, body: MigrateFromDatabaseDto });
