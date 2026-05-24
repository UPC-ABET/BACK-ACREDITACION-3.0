import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { courseOutcomeMappingsRoutes } from '../../config/course-outcome-mappings.routes';
import {
	CreateCourseOutcomeMappingDto,
	UpdateCourseOutcomeMappingDto,
	FilterCourseOutcomeMappingDto,
} from '../../model/course-outcome-mappings.dtos';

const cfg = courseOutcomeMappingsRoutes.course_outcome_mappings;

export const SwaggerCourseOutcomeMappingController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerCourseOutcomeMappingCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateCourseOutcomeMappingDto });

export const SwaggerCourseOutcomeMappingUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateCourseOutcomeMappingDto });

export const SwaggerCourseOutcomeMappingDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerCourseOutcomeMappingGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerCourseOutcomeMappingGetById = () =>
	HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerCourseOutcomeMappingGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterCourseOutcomeMappingDto });
