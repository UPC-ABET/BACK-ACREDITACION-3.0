import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { chartLevelsRoutes } from '../../config/chart-levels.routes';
import { CreateChartLevelDto, UpdateChartLevelDto, FilterChartLevelDto } from '../../model/chart-levels.dtos';

const cfg = chartLevelsRoutes.chart_levels;

export const SwaggerChartLevelController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerChartLevelCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateChartLevelDto });

export const SwaggerChartLevelUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateChartLevelDto });

export const SwaggerChartLevelDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerChartLevelGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerChartLevelGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerChartLevelGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterChartLevelDto });
