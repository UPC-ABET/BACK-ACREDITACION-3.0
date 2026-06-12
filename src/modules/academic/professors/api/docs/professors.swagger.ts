import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { professorsRoutes } from '../../config/professors.routes';
import {
	CreateProfessorDto,
	UpdateProfessorDto,
	FilterProfessorDto,
	ProfessorMaintenanceQueryDto,
	UpdateProfessorMaintenanceDto,
} from '../../model/professors.dtos';

const cfg = professorsRoutes.professors;

export const SwaggerProfessorController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerProfessorCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateProfessorDto });

export const SwaggerProfessorUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateProfessorDto });

export const SwaggerProfessorDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerProfessorGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerProfessorGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerProfessorGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterProfessorDto });

export const SwaggerProfessorGetByUserId = () => HttpMethodWithSwagger(cfg.operation.getByUserId);

export const SwaggerProfessorMaintenanceList = () =>
	HttpMethodWithSwagger({ ...cfg.operation.maintenanceList, query: ProfessorMaintenanceQueryDto });

export const SwaggerProfessorMaintenanceUpdate = () =>
	HttpMethodWithSwagger({
		...cfg.operation.maintenanceUpdate,
		body: UpdateProfessorMaintenanceDto,
	});

export const SwaggerProfessorMaintenanceDelete = () =>
	HttpMethodWithSwagger(cfg.operation.maintenanceDelete);
