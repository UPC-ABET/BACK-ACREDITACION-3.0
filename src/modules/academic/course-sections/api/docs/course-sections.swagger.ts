import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { courseSectionsRoutes } from '../../config/course-sections.routes';
import {
	CreateCourseSectionDto,
	UpdateCourseSectionDto,
	FilterCourseSectionDto,
} from '../../model/course-sections.dtos';

const cfg = courseSectionsRoutes.course_sections;

export const SwaggerCourseSectionController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerCourseSectionCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateCourseSectionDto });

export const SwaggerCourseSectionUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateCourseSectionDto });

export const SwaggerCourseSectionDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerCourseSectionGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerCourseSectionGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerCourseSectionGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterCourseSectionDto });
