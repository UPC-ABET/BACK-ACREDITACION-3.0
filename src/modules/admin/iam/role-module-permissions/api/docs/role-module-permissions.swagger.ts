import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { roleModulePermissionsRoutes } from '../../config/role-module-permissions.routes';
import {
	CreateRoleModulePermissionDto,
	UpdateRoleModulePermissionDto,
	FilterRoleModulePermissionDto,
} from '../../model/role-module-permissions.dtos';

const cfg = roleModulePermissionsRoutes;

export const SwaggerRoleModulePermissionController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerRoleModulePermissionCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateRoleModulePermissionDto });

export const SwaggerRoleModulePermissionUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateRoleModulePermissionDto });

export const SwaggerRoleModulePermissionDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerRoleModulePermissionGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerRoleModulePermissionGetById = () =>
	HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerRoleModulePermissionGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterRoleModulePermissionDto });
