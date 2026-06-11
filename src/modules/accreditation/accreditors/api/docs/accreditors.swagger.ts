import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { accreditorsRoutes } from '../../config/accreditors.routes';
import {
	CreateAccreditorDto,
	UpdateAccreditorDto,
	FilterAccreditorDto,
} from '../../model/accreditors.dtos';

const cfg = accreditorsRoutes.accreditors;

export const SwaggerAccreditorController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerAccreditorCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateAccreditorDto });

export const SwaggerAccreditorUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateAccreditorDto });

export const SwaggerAccreditorDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerAccreditorGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerAccreditorGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerAccreditorGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterAccreditorDto });
