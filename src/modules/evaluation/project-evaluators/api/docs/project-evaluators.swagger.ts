import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { projectEvaluatorsRoutes } from '../../config/project-evaluators.routes';
import {
	CreateProjectEvaluatorDto,
	UpdateProjectEvaluatorDto,
	FilterProjectEvaluatorDto,
} from '../../model/project-evaluators.dtos';

const cfg = projectEvaluatorsRoutes.project_evaluators;

export const SwaggerProjectEvaluatorController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerProjectEvaluatorCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateProjectEvaluatorDto });

export const SwaggerProjectEvaluatorUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateProjectEvaluatorDto });

export const SwaggerProjectEvaluatorDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerProjectEvaluatorGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerProjectEvaluatorGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerProjectEvaluatorGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterProjectEvaluatorDto });
