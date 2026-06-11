import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { findingsRoutes } from '../../config/findings.routes';
import { CreateFindingDto, UpdateFindingDto, FilterFindingDto } from '../../model/findings.dtos';

const cfg = findingsRoutes.findings;

export const SwaggerFindingController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerFindingCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateFindingDto });

export const SwaggerFindingUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateFindingDto });

export const SwaggerFindingDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerFindingGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerFindingGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerFindingGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterFindingDto });
