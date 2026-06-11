import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { performanceLevelsRoutes } from '../../config/performance-levels.routes';
import {
	CreatePerformanceLevelDto,
	UpdatePerformanceLevelDto,
	FilterPerformanceLevelDto,
} from '../../model/performance-levels.dtos';

const cfg = performanceLevelsRoutes.performanceLevels;

export const SwaggerPerformanceLevelController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerPerformanceLevelCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreatePerformanceLevelDto });

export const SwaggerPerformanceLevelUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdatePerformanceLevelDto });

export const SwaggerPerformanceLevelDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerPerformanceLevelGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerPerformanceLevelGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerPerformanceLevelGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterPerformanceLevelDto });
