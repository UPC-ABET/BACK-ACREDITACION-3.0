import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { usersRoutes } from '../../config/users.routes';
import {
	CreateUserDto,
	UpdateUserDto,
	FilterUserDto,
	LoginUserByCredentialsDto,
	ChangeRoleDto,
} from '../../model/users.dtos';

const cfg = usersRoutes;

export const SwaggerUserController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerUserCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateUserDto });

export const SwaggerUserUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateUserDto });

export const SwaggerUserDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerUserGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerUserGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerUserGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterUserDto });

export const SwaggerUserLoginByCredentials = () =>
	HttpMethodWithSwagger({ ...cfg.operation.loginByCredentials, body: LoginUserByCredentialsDto });

export const SwaggerUserLogout = () => HttpMethodWithSwagger({ ...cfg.operation.logout });

export const SwaggerUserChangeRole = () =>
	HttpMethodWithSwagger({ ...cfg.operation.changeRole, body: ChangeRoleDto });
