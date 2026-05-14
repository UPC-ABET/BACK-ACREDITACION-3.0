import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { typeGroupsRoutes } from '../../config/type-groups.routes';
import { CreateTypeGroupDto, UpdateTypeGroupDto, FilterTypeGroupDto } from '../../model/type-groups.dtos';

const cfg = typeGroupsRoutes.type_groups;

export const SwaggerTypeGroupController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerTypeGroupCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateTypeGroupDto });

export const SwaggerTypeGroupUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateTypeGroupDto });

export const SwaggerTypeGroupDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerTypeGroupGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerTypeGroupGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerTypeGroupGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterTypeGroupDto });
