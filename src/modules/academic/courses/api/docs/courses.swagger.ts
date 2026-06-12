import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { coursesRoutes } from '../../config/courses.routes';
import { CreateCourseDto, UpdateCourseDto, FilterCourseDto } from '../../model/courses.dtos';
import { LookupQueryDto } from 'src/commons/lookup.dtos';

const cfg = coursesRoutes.courses;

export const SwaggerCourseController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerCourseCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateCourseDto });

export const SwaggerCourseUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateCourseDto });

export const SwaggerCourseDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerCourseGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerCourseGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerCourseGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterCourseDto });

export const SwaggerCourseLookup = () =>
	HttpMethodWithSwagger({ ...cfg.operation.lookup, query: LookupQueryDto });
