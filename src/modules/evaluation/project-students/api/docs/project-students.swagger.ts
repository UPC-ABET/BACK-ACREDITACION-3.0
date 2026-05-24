import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { projectStudentsRoutes } from '../../config/project-students.routes';
import {
	CreateProjectStudentDto,
	UpdateProjectStudentDto,
	FilterProjectStudentDto,
} from '../../model/project-students.dtos';

const cfg = projectStudentsRoutes.project_students;

export const SwaggerProjectStudentController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerProjectStudentCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateProjectStudentDto });

export const SwaggerProjectStudentUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateProjectStudentDto });

export const SwaggerProjectStudentDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerProjectStudentGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerProjectStudentGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerProjectStudentGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterProjectStudentDto });
