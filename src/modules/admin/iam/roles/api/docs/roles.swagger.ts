import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { rolesRoutes } from '../../config/roles.routes';
import { CreateRoleDto, UpdateRoleDto, FilterRoleDto } from '../../model/roles.dtos';

const cfg = rolesRoutes;

export const SwaggerRoleController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerRoleCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateRoleDto });

export const SwaggerRoleUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateRoleDto });

export const SwaggerRoleDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerRoleGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerRoleGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerRoleGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterRoleDto });
