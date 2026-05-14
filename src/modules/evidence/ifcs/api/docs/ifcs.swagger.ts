import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { ifcsRoutes } from '../../config/ifcs.routes';
import { CreateIfcDto, UpdateIfcDto, FilterIfcDto } from '../../model/ifcs.dtos';

const cfg = ifcsRoutes.ifcs;

export const SwaggerIfcController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerIfcCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateIfcDto });

export const SwaggerIfcUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateIfcDto });

export const SwaggerIfcDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerIfcGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerIfcGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerIfcGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterIfcDto });
