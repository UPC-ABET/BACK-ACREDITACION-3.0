import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { findingOutcomesRoutes } from '../../config/finding-outcomes.routes';
import { CreateFindingOutcomeDto, UpdateFindingOutcomeDto, FilterFindingOutcomeDto } from '../../model/finding-outcomes.dtos';

const cfg = findingOutcomesRoutes.finding_outcomes;

export const SwaggerFindingOutcomeController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerFindingOutcomeCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateFindingOutcomeDto });

export const SwaggerFindingOutcomeUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateFindingOutcomeDto });

export const SwaggerFindingOutcomeDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerFindingOutcomeGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerFindingOutcomeGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerFindingOutcomeGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterFindingOutcomeDto });
