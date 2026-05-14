import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { facultiesRoutes } from '../../config/faculties.routes';
import { CreateFacultyDto, UpdateFacultyDto, FilterFacultyDto } from '../../model/faculties.dtos';

const cfg = facultiesRoutes.faculties;

export const SwaggerFacultyController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerFacultyCreate = () => HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateFacultyDto });

export const SwaggerFacultyUpdate = () => HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateFacultyDto });

export const SwaggerFacultyDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerFacultyGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerFacultyGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerFacultyGetByFilters = () => HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterFacultyDto });
