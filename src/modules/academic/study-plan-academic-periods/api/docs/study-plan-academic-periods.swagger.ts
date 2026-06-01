import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { studyPlanAcademicPeriodsRoutes } from '../../config/study-plan-academic-periods.routes';
import { FilterStudyPlanAcademicPeriodDto } from '../../model/study-plan-academic-periods.dtos';

const cfg = studyPlanAcademicPeriodsRoutes.studyPlanAcademicPeriods;

export const SwaggerStudyPlanAcademicPeriodController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerStudyPlanAcademicPeriodGetAll = () =>
	HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerStudyPlanAcademicPeriodGetById = () =>
	HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerStudyPlanAcademicPeriodGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterStudyPlanAcademicPeriodDto });
