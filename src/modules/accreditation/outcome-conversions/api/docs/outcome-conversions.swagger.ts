import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { outcomeConversionsRoutes } from '../../config/outcome-conversions.routes';
import {
	CreateOutcomeConversionDto,
	UpdateOutcomeConversionDto,
	FilterOutcomeConversionDto,
} from '../../model/outcome-conversions.dtos';

const cfg = outcomeConversionsRoutes.outcomeConversions;

export const SwaggerOutcomeConversionController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerOutcomeConversionCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateOutcomeConversionDto });

export const SwaggerOutcomeConversionUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateOutcomeConversionDto });

export const SwaggerOutcomeConversionDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerOutcomeConversionGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerOutcomeConversionGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterOutcomeConversionDto });

export const SwaggerOutcomeConversionCoverage = () => HttpMethodWithSwagger(cfg.operation.coverage);
