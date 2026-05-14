import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { plansRoutes } from '../../config/plans.routes';
import { CreatePlanDto, UpdatePlanDto, FilterPlanDto } from '../../model/plans.dtos';

const cfg = plansRoutes.plans;

export const SwaggerPlanController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerPlanCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreatePlanDto });

export const SwaggerPlanUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdatePlanDto });

export const SwaggerPlanDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerPlanGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerPlanGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerPlanGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterPlanDto });
