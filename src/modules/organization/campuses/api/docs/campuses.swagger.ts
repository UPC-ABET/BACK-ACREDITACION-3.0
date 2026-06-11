import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { campusesRoutes } from '../../config/campuses.routes';
import { CreateCampusDto, UpdateCampusDto, FilterCampusDto } from '../../model/campuses.dtos';

const cfg = campusesRoutes.campuses;

export const SwaggerCampusController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerCampusCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateCampusDto });

export const SwaggerCampusUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateCampusDto });

export const SwaggerCampusDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerCampusGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerCampusGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerCampusGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterCampusDto });
