import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { chartsRoutes } from '../../config/charts.routes';
import {
	CreateChartDto,
	UpdateChartDto,
	FilterChartDto,
	CreateChartNodeDto,
	UpdateChartNodeDto,
	ResetMaintenancePasswordsDto,
} from '../../model/charts.dtos';

const cfg = chartsRoutes.charts;

export const SwaggerChartController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerChartCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateChartDto });

export const SwaggerChartUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateChartDto });

export const SwaggerChartDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerChartGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerChartGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerChartGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterChartDto });

export const SwaggerChartMaintenanceTree = () =>
	HttpMethodWithSwagger(cfg.operation.maintenanceTree);

export const SwaggerChartMaintenanceCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.maintenanceCreate, body: CreateChartNodeDto });

export const SwaggerChartMaintenanceUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.maintenanceUpdate, body: UpdateChartNodeDto });

export const SwaggerChartMaintenanceDelete = () =>
	HttpMethodWithSwagger(cfg.operation.maintenanceDelete);

export const SwaggerChartMaintenanceResetPasswords = () =>
	HttpMethodWithSwagger({
		...cfg.operation.maintenanceResetPasswords,
		body: ResetMaintenancePasswordsDto,
	});
