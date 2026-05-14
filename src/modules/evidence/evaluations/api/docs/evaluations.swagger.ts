import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { evaluationsRoutes } from '../../config/evaluations.routes';
import { CreateEvaluationDto, UpdateEvaluationDto, FilterEvaluationDto } from '../../model/evaluations.dtos';

const cfg = evaluationsRoutes.evaluations;

export const SwaggerEvaluationController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerEvaluationCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateEvaluationDto });

export const SwaggerEvaluationUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateEvaluationDto });

export const SwaggerEvaluationDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerEvaluationGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerEvaluationGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerEvaluationGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterEvaluationDto });
