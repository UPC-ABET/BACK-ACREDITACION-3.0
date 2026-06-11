import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { statusesRoutes } from '../../config/statuses.routes';
import { CreateStatusDto, UpdateStatusDto, FilterStatusDto } from '../../model/statuses.dtos';

const cfg = statusesRoutes.statuses;

export const SwaggerStatusController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerStatusCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateStatusDto });

export const SwaggerStatusUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateStatusDto });

export const SwaggerStatusDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerStatusGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerStatusGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerStatusGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterStatusDto });
