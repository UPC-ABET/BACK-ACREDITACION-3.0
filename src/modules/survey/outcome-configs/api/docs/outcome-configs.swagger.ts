import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { outcomeConfigsRoutes } from '../../config/outcome-configs.routes';
import { CreateOutcomeConfigDto, UpdateOutcomeConfigDto, FilterOutcomeConfigDto } from '../../model/outcome-configs.dtos';

const cfg = outcomeConfigsRoutes.outcome_configs;

export const SwaggerOutcomeConfigController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerOutcomeConfigCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateOutcomeConfigDto });

export const SwaggerOutcomeConfigUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateOutcomeConfigDto });

export const SwaggerOutcomeConfigDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerOutcomeConfigGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerOutcomeConfigGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerOutcomeConfigGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterOutcomeConfigDto });
