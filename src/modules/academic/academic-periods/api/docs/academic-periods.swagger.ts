import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { academicPeriodsRoutes } from '../../config/academic-periods.routes';
import { FilterAcademicPeriodDto } from '../../model/academic-periods.dtos';

const cfg = academicPeriodsRoutes.academicPeriods;

export const SwaggerAcademicPeriodController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerAcademicPeriodGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerAcademicPeriodGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerAcademicPeriodGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterAcademicPeriodDto });
