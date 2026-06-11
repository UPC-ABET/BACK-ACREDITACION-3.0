import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { planActionsRoutes } from '../../config/plan-actions.routes';
import {
	CreatePlanActionDto,
	UpdatePlanActionDto,
	FilterPlanActionDto,
} from '../../model/plan-actions.dtos';

const cfg = planActionsRoutes.planActions;

export const SwaggerPlanActionController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerPlanActionCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreatePlanActionDto });

export const SwaggerPlanActionUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdatePlanActionDto });

export const SwaggerPlanActionDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerPlanActionGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerPlanActionGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerPlanActionGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterPlanActionDto });
