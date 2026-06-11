import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { actionsRoutes } from '../../config/actions.routes';
import { CreateActionDto, UpdateActionDto, FilterActionDto } from '../../model/actions.dtos';

const cfg = actionsRoutes.actions;

export const SwaggerActionController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerActionCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateActionDto });

export const SwaggerActionUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateActionDto });

export const SwaggerActionDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerActionGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerActionGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerActionGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterActionDto });
