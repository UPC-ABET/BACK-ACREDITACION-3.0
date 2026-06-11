import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { parametersRoutes } from '../../config/parameters.routes';
import {
	CreateParameterDto,
	UpdateParameterDto,
	FilterParameterDto,
} from '../../model/parameters.dtos';

const cfg = parametersRoutes.parameters;

export const SwaggerParameterController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerParameterCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateParameterDto });

export const SwaggerParameterUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateParameterDto });

export const SwaggerParameterDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerParameterGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerParameterGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerParameterGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterParameterDto });
