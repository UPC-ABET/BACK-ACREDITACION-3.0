import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { findingActionsRoutes } from '../../config/finding-actions.routes';
import {
	CreateFindingActionDto,
	UpdateFindingActionDto,
	FilterFindingActionDto,
} from '../../model/finding-actions.dtos';

const cfg = findingActionsRoutes.finding_actions;

export const SwaggerFindingActionController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerFindingActionCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateFindingActionDto });

export const SwaggerFindingActionUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateFindingActionDto });

export const SwaggerFindingActionDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerFindingActionGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerFindingActionGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerFindingActionGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterFindingActionDto });
