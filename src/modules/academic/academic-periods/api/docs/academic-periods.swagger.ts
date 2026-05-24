import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { academicPeriodsRoutes } from '../../config/academic-periods.routes';
import {
	CreateAcademicPeriodDto,
	UpdateAcademicPeriodDto,
	FilterAcademicPeriodDto,
} from '../../model/academic-periods.dtos';

const cfg = academicPeriodsRoutes.academic_periods;

export const SwaggerAcademicPeriodController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerAcademicPeriodCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateAcademicPeriodDto });

export const SwaggerAcademicPeriodUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateAcademicPeriodDto });

export const SwaggerAcademicPeriodDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerAcademicPeriodGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerAcademicPeriodGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerAcademicPeriodGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterAcademicPeriodDto });
