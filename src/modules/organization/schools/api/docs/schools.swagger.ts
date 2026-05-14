import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { schoolsRoutes } from '../../config/schools.routes';
import { CreateSchoolDto, UpdateSchoolDto, FilterSchoolDto } from '../../model/schools.dtos';

const cfg = schoolsRoutes.schools;

export const SwaggerSchoolController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerSchoolCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateSchoolDto });

export const SwaggerSchoolUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateSchoolDto });

export const SwaggerSchoolDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerSchoolGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerSchoolGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerSchoolGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterSchoolDto });
