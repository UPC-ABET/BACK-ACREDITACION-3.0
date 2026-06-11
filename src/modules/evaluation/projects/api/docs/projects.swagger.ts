import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { projectsRoutes } from '../../config/projects.routes';
import { CreateProjectDto, UpdateProjectDto, FilterProjectDto } from '../../model/projects.dtos';

const cfg = projectsRoutes.projects;

export const SwaggerProjectController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerProjectCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateProjectDto });

export const SwaggerProjectUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateProjectDto });

export const SwaggerProjectDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerProjectGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerProjectGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerProjectGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterProjectDto });
