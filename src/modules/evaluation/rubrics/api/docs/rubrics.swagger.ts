import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { rubricsRoutes } from '../../config/rubrics.routes';
import { CreateRubricDto, UpdateRubricDto, FilterRubricDto } from '../../model/rubrics.dtos';

const cfg = rubricsRoutes.rubrics;

export const SwaggerRubricController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerRubricCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateRubricDto });

export const SwaggerRubricUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateRubricDto });

export const SwaggerRubricDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerRubricGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerRubricGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerRubricGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterRubricDto });
