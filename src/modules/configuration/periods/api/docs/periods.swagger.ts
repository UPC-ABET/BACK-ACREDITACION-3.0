import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { periodsRoutes } from '../../config/periods.routes';
import { CreatePeriodDto } from '../../model/periods.dtos';

const cfg = periodsRoutes.periods;

export const SwaggerPeriodsController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerPeriodsCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreatePeriodDto });

export const SwaggerPeriodsList = () => HttpMethodWithSwagger(cfg.operation.list);

export const SwaggerPeriodsFind = () =>
	HttpMethodWithSwagger({ ...cfg.operation.find, param: { name: 'periodId', type: Number } });

export const SwaggerPeriodsClose = () =>
	HttpMethodWithSwagger({ ...cfg.operation.close, param: { name: 'periodId', type: Number } });
