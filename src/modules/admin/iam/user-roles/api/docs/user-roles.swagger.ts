import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { userRolesRoutes } from '../../config/user-roles.routes';
import {
	CreateUserRoleDto,
	UpdateUserRoleDto,
	FilterUserRoleDto,
} from '../../model/user-roles.dtos';

const cfg = userRolesRoutes;

export const SwaggerUserRoleController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerUserRoleCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateUserRoleDto });

export const SwaggerUserRoleUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateUserRoleDto });

export const SwaggerUserRoleDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerUserRoleGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerUserRoleGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerUserRoleGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterUserRoleDto });
