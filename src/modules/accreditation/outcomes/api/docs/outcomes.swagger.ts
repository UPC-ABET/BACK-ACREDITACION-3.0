import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { outcomesRoutes } from '../../config/outcomes.routes';
import {
	CreateOutcomeDto,
	UpdateOutcomeDto,
	FilterOutcomeDto,
	OutcomeMaintenanceQueryDto,
	UpdateOutcomeMaintenanceDto,
	CreateOutcomeMaintenanceDto,
} from '../../model/outcomes.dtos';

const cfg = outcomesRoutes.outcomes;

export const SwaggerOutcomeController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerOutcomeCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateOutcomeDto });

export const SwaggerOutcomeUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateOutcomeDto });

export const SwaggerOutcomeDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerOutcomeGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerOutcomeGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerOutcomeGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterOutcomeDto });

export const SwaggerOutcomeMaintenanceCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.maintenanceCreate, body: CreateOutcomeMaintenanceDto });

export const SwaggerOutcomeMaintenanceList = () =>
	HttpMethodWithSwagger({ ...cfg.operation.maintenanceList, query: OutcomeMaintenanceQueryDto });

export const SwaggerOutcomeMaintenanceUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.maintenanceUpdate, body: UpdateOutcomeMaintenanceDto });

export const SwaggerOutcomeMaintenanceDelete = () =>
	HttpMethodWithSwagger(cfg.operation.maintenanceDelete);
