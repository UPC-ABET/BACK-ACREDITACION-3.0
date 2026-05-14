import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { studentsRoutes } from '../../config/students.routes';
import { CreateStudentDto, UpdateStudentDto, FilterStudentDto } from '../../model/students.dtos';

const cfg = studentsRoutes.students;

export const SwaggerStudentController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerStudentCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateStudentDto });

export const SwaggerStudentUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateStudentDto });

export const SwaggerStudentDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerStudentGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerStudentGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerStudentGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterStudentDto });
