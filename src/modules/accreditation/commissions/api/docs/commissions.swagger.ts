import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { commissionsRoutes } from '../../config/commissions.routes';
import {
	CreateCommissionDto,
	UpdateCommissionDto,
	FilterCommissionDto,
} from '../../model/commissions.dtos';

const cfg = commissionsRoutes.commissions;

export const SwaggerCommissionController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerCommissionCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateCommissionDto });

export const SwaggerCommissionUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateCommissionDto });

export const SwaggerCommissionDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerCommissionGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerCommissionGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerCommissionGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterCommissionDto });
