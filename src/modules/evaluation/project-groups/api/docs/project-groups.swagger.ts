import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { projectGroupsRoutes } from '../../config/project-groups.routes';
import {
	CreateProjectGroupDto,
	UpdateProjectGroupDto,
	FilterProjectGroupDto,
} from '../../model/project-groups.dtos';

const cfg = projectGroupsRoutes.projectGroups;

export const SwaggerProjectGroupController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerProjectGroupCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateProjectGroupDto });

export const SwaggerProjectGroupUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateProjectGroupDto });

export const SwaggerProjectGroupDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerProjectGroupGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerProjectGroupGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerProjectGroupGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterProjectGroupDto });
