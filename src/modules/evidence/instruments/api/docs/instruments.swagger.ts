import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { instrumentsRoutes } from '../../config/instruments.routes';
import {
	CreateInstrumentDto,
	UpdateInstrumentDto,
	FilterInstrumentDto,
} from '../../model/instruments.dtos';

const cfg = instrumentsRoutes.instruments;

export const SwaggerInstrumentController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerInstrumentCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateInstrumentDto });

export const SwaggerInstrumentUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateInstrumentDto });

export const SwaggerInstrumentDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerInstrumentGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerInstrumentGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerInstrumentGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterInstrumentDto });
