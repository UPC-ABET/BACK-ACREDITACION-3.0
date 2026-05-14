import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { rubricScalesRoutes } from '../../config/rubric-scales.routes';
import { CreateRubricScaleDto, UpdateRubricScaleDto, FilterRubricScaleDto } from '../../model/rubric-scales.dtos';

const cfg = rubricScalesRoutes.rubric_scales;

export const SwaggerRubricScaleController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerRubricScaleCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateRubricScaleDto });

export const SwaggerRubricScaleUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateRubricScaleDto });

export const SwaggerRubricScaleDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerRubricScaleGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerRubricScaleGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerRubricScaleGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterRubricScaleDto });
