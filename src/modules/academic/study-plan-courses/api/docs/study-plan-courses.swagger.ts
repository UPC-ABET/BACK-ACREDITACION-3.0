import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { studyPlanCoursesRoutes } from '../../config/study-plan-courses.routes';
import {
	CreateStudyPlanCourseDto,
	UpdateStudyPlanCourseDto,
	FilterStudyPlanCourseDto,
} from '../../model/study-plan-courses.dtos';

const cfg = studyPlanCoursesRoutes.studyPlanCourses;

export const SwaggerStudyPlanCourseController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerStudyPlanCourseCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateStudyPlanCourseDto });

export const SwaggerStudyPlanCourseUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateStudyPlanCourseDto });

export const SwaggerStudyPlanCourseDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerStudyPlanCourseGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerStudyPlanCourseGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerStudyPlanCourseGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterStudyPlanCourseDto });
